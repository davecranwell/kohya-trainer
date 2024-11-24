// NB changing the path of this file will require your google app details to be updated
import { LoaderFunctionArgs } from '@remix-run/node';

import { authenticator } from '~/services/auth.server';

export const loader = ({ request, params }: LoaderFunctionArgs) => {
    return authenticator.authenticate(params.provider as string, request, {
        successRedirect: '/dashboard',
        throwOnError: true,
    });
};
