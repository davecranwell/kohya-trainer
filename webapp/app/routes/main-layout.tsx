import { data, Link, LoaderFunctionArgs, Outlet, useLoaderData } from 'react-router';

import { Button } from '~/components/button';
import { isAuthenticated } from '~/services/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
    const isLoggedIn = await isAuthenticated(request);

    return data({ isLoggedIn });
}

export default function MainLayout() {
    const { isLoggedIn } = useLoaderData<typeof loader>();

    return (
        <div>
            <div className="flex flex-row items-center justify-between border-b border-gray-800 p-4">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    <Link to="/training" className="bg-gradient-to-r from-primary via-accent1 to-accent2 bg-clip-text text-transparent">
                        Likera
                    </Link>
                </h1>
                {isLoggedIn && (
                    <Button variant="textonly" size="text" asChild>
                        <Link to="/logout">Log out</Link>
                    </Button>
                )}
            </div>
            <Outlet />
        </div>
    );
}
