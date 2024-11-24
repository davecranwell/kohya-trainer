import { ActionFunctionArgs, redirect } from '@remix-run/node';

import { authenticator } from '~/services/auth.server';

// Prevent GET access, only POST is allowed
export const loader = () => redirect('/login');

export const action = ({ request, params }: ActionFunctionArgs) => {
    return authenticator.authenticate(params.provider as string, request, {
        successRedirect: '/dashboard',
        throwOnError: true,
    });
};
