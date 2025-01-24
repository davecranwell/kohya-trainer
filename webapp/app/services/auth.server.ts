import invariant from 'tiny-invariant';
import { redirect } from 'react-router';
import { Authenticator } from 'remix-auth';
import { FormStrategy } from 'remix-auth-form';
import { safeRedirect } from 'remix-utils/safe-redirect';
// import { GoogleStrategy } from 'remix-auth-google';

import { sessionStorage, getSession, commitSession, destroySession } from '~/services/session.server';
import { verifyEmailPassword, findOrCreateUser } from '~/services/account.server';

export type User = {
    id: string;
};

export const authenticator = new Authenticator<User>();

// authenticator.use(
//     new GoogleStrategy(
//         {
//             clientID: process.env.GOOGLE_CLIENT_ID!,
//             clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//             callbackURL: 'http://localhost:3000/auth/google/callback',
//         },
//         async ({ accessToken, refreshToken, extraParams, profile }) => {
//             // Get the user data from your DB or API using the tokens and profile
//             return await findOrCreateUser({ email: profile.emails[0].value, name: profile.displayName });
//         },
//     ),
// );

authenticator.use(
    new FormStrategy(async ({ form }) => {
        const email = form.get('email');
        const password = form.get('password');

        invariant(typeof email === 'string', 'email must be a string');
        invariant(email.length > 0, 'email must not be empty');
        invariant(typeof password === 'string', 'password must be a string');
        invariant(password.length > 0, 'password must not be empty');

        return await verifyEmailPassword(email, password);
    }),
    'email-pass',
);

export async function isAuthenticated(request: Request) {
    let session = await getSession(request.headers.get('cookie'));
    let user = session.get('user');

    return !!user;
}

export async function requireAuthenticated(request: Request, returnTo?: string) {
    let session = await getSession(request.headers.get('cookie'));
    let user = session.get('user');

    if (user) return user;

    if (returnTo) session.set('returnTo', returnTo);

    throw redirect('/login', {
        headers: { 'Set-Cookie': await commitSession(session) },
    });
}

// TODO: make function params closer to requireAuthenticated
export async function logout(request: Request, redirectTo = '/') {
    let session = await getSession(request.headers.get('cookie'));

    return redirect(safeRedirect(redirectTo), {
        headers: { 'Set-Cookie': await destroySession(session) },
    });
}
