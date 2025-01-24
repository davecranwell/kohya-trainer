import type { LinksFunction, MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { requireAuthenticated } from '~/services/auth.server';

export const links: LinksFunction = () => {
    return [];
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
    {
        title: 'Title',
    },
];

export async function action({ request }: ActionFunctionArgs) {
    return {};
}

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAuthenticated(request);

    return redirect('/training');
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
