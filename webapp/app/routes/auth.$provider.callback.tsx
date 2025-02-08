import { LoaderFunctionArgs, redirect } from 'react-router';

import { authenticator } from '~/services/auth.server';
import { sessionStorage } from '~/services/session.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const user = await authenticator.authenticate(params.provider as string, request);

    const session = await sessionStorage.getSession(request.headers.get('cookie'));
    session.set('user', user);

    throw redirect('/training', {
        headers: { 'Set-Cookie': await sessionStorage.commitSession(session) },
    });
};

export default function AuthCallback() {
    return <div>AuthCallback</div>;
}
