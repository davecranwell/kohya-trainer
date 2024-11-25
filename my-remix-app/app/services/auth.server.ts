import invariant from 'tiny-invariant';
import { redirect } from '@remix-run/node';
import { Authenticator } from 'remix-auth';
import { FormStrategy } from 'remix-auth-form';
import { safeRedirect } from 'remix-utils/safe-redirect';
import { GoogleStrategy } from 'remix-auth-google';

import { sessionStorage, getSession, destroySession } from '~/services/session.server';
import { verifyEmailPassword, findOrCreateUser } from '~/services/account.server';

export type User = {
    id: string;
};

export const authenticator = new Authenticator<User>(sessionStorage);

authenticator.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: 'http://localhost:3000/auth/google/callback',
        },
        async ({ accessToken, refreshToken, extraParams, profile }) => {
            // Get the user data from your DB or API using the tokens and profile
            return await findOrCreateUser({ email: profile.emails[0].value, name: profile.displayName });
        },
    ),
);

authenticator.use(
    new FormStrategy(async ({ form, context }) => {
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

export async function logout(
    {
        request,
        redirectTo = '/',
    }: {
        request: Request;
        redirectTo?: string;
    },
    responseInit?: ResponseInit,
) {
    await authenticator.logout(request, { redirectTo: safeRedirect(redirectTo) });
}
