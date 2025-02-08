import { ActionFunctionArgs, redirect } from 'react-router';

import { authenticator } from '~/services/auth.server';

// // Prevent GET access, only POST is allowed
// export const loader = () => redirect('/login');

export const action = ({ request, params }: ActionFunctionArgs) => {
    return authenticator.authenticate(params.provider as string, request);
};
