import { LoaderFunctionArgs, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { logout } from '#app/utils/auth.server.ts';

export async function loader({ request }: LoaderFunctionArgs) {
    return logout({ request });
}

export async function action({ request }: ActionFunctionArgs) {
    return logout({ request });
}
