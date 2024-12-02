import 'dotenv/config';
import crypto from 'node:crypto';
import { createRequestHandler } from '@remix-run/express';
import { ip as ipAddress } from 'address';
import chalk from 'chalk';
import closeWithGrace from 'close-with-grace';
import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import { assignGpuToTraining } from './cron/createGpuInstance.js';
import { shutdownInactiveGpus } from './cron/shutdownInactiveGpus.js';

const MODE = process.env.NODE_ENV ?? 'development';
const IS_PROD = MODE === 'production';
const ALLOW_INDEXING = process.env.ALLOW_INDEXING !== 'false';
const USE_CRON = process.env.USE_CRON !== 'false';
const PORT = process.env.PORT || 3000;

const app = express();

app.use(compression());

app.disable('x-powered-by');

const viteDevServer = IS_PROD
    ? undefined
    : await import('vite').then((vite) =>
          vite.createServer({
              server: { middlewareMode: true },
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

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
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
                'connect-src': ["'self'", 'localhost:24678'],
                'script-src': ["'strict-dynamic'", "'self'", (_, res) => `'nonce-${res.locals.cspNonce}'`],
                'script-src-attr': [(_, res) => `'nonce-${res.locals.cspNonce}'`],
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

async function getBuild() {
    try {
        const build = viteDevServer
            ? await viteDevServer.ssrLoadModule('virtual:remix/server-build')
            : // eslint-disable-next-line import/no-unresolved
              await import('../build/server/index.js');

        return { build: build, error: null };
    } catch (error) {
        // Catch error and return null to make express happy and avoid an unrecoverable crash
        console.error('Error creating build:', error);
        return { error: error, build: null };
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
        getLoadContext: (req, res) => ({
            cspNonce: res.locals.cspNonce,
            serverBuild: getBuild(),
        }),
        mode: MODE,
        build: async () => {
            const { error, build } = await getBuild();
            // gracefully "catch" the error
            if (error) {
                throw error;
            }
            return build;
        },
    }),
);

const server = app.listen(PORT, () => {
    console.log(`🚀 We have liftoff!`);
    console.log(`http://localhost:${PORT}`);

    if (USE_CRON) {
        assignGpuToTraining();
        shutdownInactiveGpus();
    }
});

closeWithGrace(async () => {
    await new Promise((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve('ok')));
    });
});
