import { createCookieSessionStorage } from '@remix-run/node';

export const getSessionExpirationDate = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

// export the whole sessionStorage object
export const sessionStorage = createCookieSessionStorage({
    cookie: {
        name: '_session',
        sameSite: 'lax', // this helps with CSRF
        path: '/', // remember to add this so the cookie will work in all routes
        httpOnly: true, // for security reasons, make this cookie http only
        secrets: [process.env.SESSION_SECRET!],
        secure: process.env.NODE_ENV === 'production', // enable this in prod only
    },
});

// you can also export the methods individually for your own usage
export const { getSession, commitSession, destroySession } = sessionStorage;
