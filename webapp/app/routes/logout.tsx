import { LoaderFunctionArgs, redirect, type ActionFunctionArgs } from 'react-router';
import { logout } from '~/services/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
    return logout(request);
}

export async function action({ request }: ActionFunctionArgs) {
    return logout(request);
}
