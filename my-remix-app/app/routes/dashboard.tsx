import type { LinksFunction, MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

import { authenticator } from '~/services/auth.server';

export const links: LinksFunction = () => {
    return [];
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
    {
        title: 'Title',
    },
];

export async function action({ request }: ActionFunctionArgs) {
    return json({});
}

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await authenticator.isAuthenticated(request, {
        failureRedirect: '/login',
    });
    return json({ user });
}

export default function Dashboard() {
    const { user } = useLoaderData<typeof loader>();

    return (
        <div>
            <h1>Dashboard</h1>
            <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
    );
}
