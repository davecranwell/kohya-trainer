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
import { createRequestHandler } from '@remix-run/express';
import type { ServerBuild } from '@remix-run/node';

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
    level: process.env.LOG_LEVEL || 'error',
    transport: !IS_PROD
        ? {
              target: 'pino-pretty',
              options: {
                  colorize: true,
                  ignore: 'pid,hostname',
                  translateTime: 'SYS:standard',
              },
          }
        : undefined,
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    // Redact sensitive info from logs
    redact: ['req.headers.authorization', 'req.headers.cookie'],
});

// Create HTTP logger middleware
const httpLogger = pinoHttp({
    logger,
    // Generate request ID if not present in headers
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomBytes(16).toString('hex'),
    customProps: (req, res) => ({
        // Add any custom properties you want in every log
        environment: MODE,
    }),
    // Skip logging health checks in production
    autoLogging: {
        ignore: (req) => IS_PROD && req.url === '/healthcheck',
    },
});

const app = express();

app.use(compression());
app.use(httpLogger);
app.disable('x-powered-by');

let viteDevServer: any;

if (!IS_PROD) {
    // IFFE avoids complaints about top-level await in CJS format
    // We have to use CJS due to the number of dependencies that are not ESM
    (async () => {
        viteDevServer = await import('vite').then((vite) =>
            vite.createServer({
                server: { middlewareMode: true },
                // Required for HMR to work properly
                appType: 'custom',
            }),
        );
        app.use(viteDevServer.middlewares);
    })();
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
                'img-src': ["'self'", 'data:', 'blob:'],
                'connect-src': ["'self'", 'ws://localhost:*'],
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

const strongPaths = ['/login', '/sign-up', '/verify', '/reset-password'];

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

app.use((err: Error, req: Request, res: Response, next: Function) => {
    req.log.error(
        {
            err,
            request: {
                url: req.url,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('user-agent'),
            },
        },
        'Unhandled error',
    );
    next(err);
});

async function getBuild(): Promise<{ build: ServerBuild | null; error: Error | null }> {
    try {
        const build = IS_PROD ? await import('../build/server/index.js') : await viteDevServer.ssrLoadModule('virtual:remix/server-build');

        // eslint-disable-next-line import/no-unresolved
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

async function startServer() {
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
