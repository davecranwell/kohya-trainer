import { config } from 'dotenv';
import crypto from 'node:crypto';
import cron from 'node-cron';
import closeWithGrace from 'close-with-grace';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { createRequestHandler } from '@react-router/express';
import type { ServerBuild } from 'react-router';

import { subscribeToTasks } from '../lib/task.server';
import { shutdownInactiveGpus } from '../lib/tasks/shutdownInactiveGpus';

// Extend Express types to include locals
declare global {
    namespace Express {
        interface Locals {
            cspNonce: string;
        }
    }
}

const MODE = process.env.NODE_ENV ?? 'development';
const IS_PROD = MODE === 'production';
const ALLOW_INDEXING = process.env.ALLOW_INDEXING !== 'false';
const USE_CRON = process.env.USE_CRON !== 'false';
const USE_QUEUE = process.env.USE_QUEUE !== 'false';
const PORT = process.env.PORT || 3000;

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(IS_PROD
        ? {
              destination: 1,
              formatters: {
                  level: (label) => ({ level: label }),
                  bindings: (bindings) => ({
                      pid: process.pid,
                      time: new Date().toISOString(),
                  }),
              },
          }
        : {
              transport: {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                      ignore: 'pid,hostname',
                      translateTime: 'SYS:standard',
                  },
              },
          }),
    redact: ['req.headers.authorization', 'req.headers.cookie'],
});

const httpLogger = pinoHttp({
    logger,
    // Disable automatic error logging since we'll handle it ourselves
    wrapSerializers: false,
    customProps: (req, res) => ({
        environment: MODE,
    }),
    // Only set request id
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomBytes(16).toString('hex'),
    customLogLevel: function (req, res, err) {
        if (res.statusCode >= 400 || err) {
            return 'error';
        }
        return 'info';
    },
    customSuccessMessage: function (req, res) {
        if (res.statusCode >= 400) {
            return `${req.method} ${req.url} ${res.statusCode}`;
        }
        return `${req.method} ${req.url}`;
    },
    customErrorMessage: function (req, res, err) {
        return `${req.method} ${req.url} failed: ${err?.message}`;
    },
    serializers: {
        err: (err) => {
            // Only serialize error details for actual Error objects
            if (err && err instanceof Error) {
                return {
                    type: err.constructor.name,
                    message: err.message,
                    stack: err.stack,
                };
            }
            return err;
        },
        req: (req) => {
            return {
                method: req.method,
                url: req.url,
            };
        },
    },
    autoLogging: {
        ignore: (req) => IS_PROD && req.url === '/healthcheck',
    },
});

async function startServer() {
    const app = express();

    app.use(compression());
    //app.use(httpLogger);
    app.disable('x-powered-by');

    // Create dev server first so we can use it in the request handler
    const viteDevServer = IS_PROD
        ? undefined
        : await import('vite').then((vite) =>
              vite.createServer({
                  server: { middlewareMode: true },
                  // Required for HMR to work properly
                  appType: 'custom',
              }),
          );

    if (viteDevServer) {
        app.use(viteDevServer.middlewares);
    } else {
        // Remix fingerprints its assets so we can cache forever.
        app.use('/assets', express.static('build/client/assets', { immutable: true, maxAge: '1y' }));

        // Everything else (like favicon.ico) is cached for an hour. You may want to be
        // more aggressive with this caching.
        app.use(express.static('build/client', { maxAge: '1h' }));
    }

    app.use((req, res, next) => {
        res.locals.cspNonce = crypto.randomBytes(16).toString('hex');
        next();
    });

    app.use(
        helmet({
            frameguard: { action: 'deny' },
            xPoweredBy: false,
            referrerPolicy: { policy: 'same-origin' },
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
                directives: {
                    'font-src': ["'self'", 'fonts.gstatic.com'],
                    'frame-src': ["'self'"],
                    'img-src': ["'self'", 'data:', 'blob:', `https://${process.env.AWS_S3_THUMBNAILS_BUCKET_NAME!}.s3.us-east-1.amazonaws.com`],
                    'connect-src': ["'self'", 'ws://localhost:*', `https://${process.env.AWS_S3_UPLOAD_BUCKET_NAME!}.s3.us-east-1.amazonaws.com`],
                    'script-src': ["'strict-dynamic'", "'self'", (_, res) => `'nonce-${(res as Response).locals.cspNonce}'`],
                    'script-src-attr': [(_, res) => `'nonce-${(res as Response).locals.cspNonce}'`],
                    'upgrade-insecure-requests': null,
                },
            },
        }),
    );

    // When running tests or running in development, we want to effectively disable
    // rate limiting because playwright tests are very fast and we don't want to
    // have to wait for the rate limit to reset between tests.
    const maxMultiple = !IS_PROD || process.env.PLAYWRIGHT_TEST_BASE_URL ? 10_000 : 1;

    const rateLimitDefault = {
        windowMs: 60 * 1000,
        max: 1000 * maxMultiple,
        standardHeaders: true,
        legacyHeaders: false,
        validate: { trustProxy: false },
    };

    const strongestRateLimit = rateLimit({
        ...rateLimitDefault,
        windowMs: 60 * 1000,
        max: 10 * maxMultiple,
    });

    const strongRateLimit = rateLimit({
        ...rateLimitDefault,
        windowMs: 60 * 1000,
        max: 100 * maxMultiple,
    });

    const strongPaths = ['/login', '/signup', '/verify', '/reset-password'];

    const generalRateLimit = rateLimit(rateLimitDefault);

    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (strongPaths.some((p) => req.path.includes(p))) {
                return strongestRateLimit(req, res, next);
            }
            return strongRateLimit(req, res, next);
        }

        // the verify route is a special case because it's a GET route that
        // can have a token in the query string
        if (req.path.includes('/verify')) {
            return strongestRateLimit(req, res, next);
        }

        return generalRateLimit(req, res, next);
    });

    async function getBuild(): Promise<{ build: ServerBuild | null; error: Error | null }> {
        try {
            const build = viteDevServer
                ? await viteDevServer.ssrLoadModule('virtual:react-router/server-build')
                : // eslint-disable-next-line import/no-unresolved
                  await import('../build/server/index.js');

            return { build: build as ServerBuild, error: null };
        } catch (error) {
            console.error('Error creating build:', error);
            return { error: error as Error, build: null };
        }
    }

    if (!ALLOW_INDEXING) {
        console.log('Disabling indexing');
        app.use((req, res, next) => {
            res.set('X-Robots-Tag', 'noindex, nofollow');
            next();
        });
    }

    app.all(
        '*',
        createRequestHandler({
            getLoadContext: (req: Request, res: Response) => ({
                cspNonce: res.locals.cspNonce,
                serverBuild: getBuild(),
            }),
            mode: MODE,
            // Ensure we handle the build properly and never return null
            build: async () => {
                const { error, build } = await getBuild();
                if (error || !build) {
                    throw error || new Error('Failed to load build');
                }
                return build as ServerBuild;
            },
        }),
    );

    const server = app.listen(PORT, async () => {
        console.log(`🚀 We have liftoff!`);
        console.log(`http://localhost:${PORT}`);

        if (USE_QUEUE) {
            subscribeToTasks();
        }

        if (USE_CRON) {
            cron.schedule('*/5 * * * *', shutdownInactiveGpus); // Run every 5 minutes
            console.log('GPU Manager shutdownInactiveGpus job scheduled');
        }
    });

    closeWithGrace(async () => {
        await new Promise((resolve, reject) => {
            server.close((e) => (e ? reject(e) : resolve('ok')));
        });
    });
}

startServer().catch((e) => {
    console.error(e);
    process.exit(1);
});
