// This is called a "splat route" and as it's in the root `/app/routes/`
// directory, it's a catchall. If no other routes match, this one will and we
// can know that the user is hitting a URL that doesn't exist. By throwing a
// 404 from the loader, we can force the error boundary to render which will
// ensure the user gets the right status code and we can display a nicer error
// message for them than the Remix and/or browser default.

import { Link, useLocation } from '@remix-run/react';
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx';
import { Icon } from '#app/components/ui/icon.tsx';

export async function loader() {
    throw new Response('Not found', { status: 404 });
}

export default function NotFound() {
    // due to the loader, this component will never be rendered, but we'll return
    // the error boundary just in case.
    return <ErrorBoundary />;
}

export function ErrorBoundary() {
    return (
        <GeneralErrorBoundary
            statusHandlers={{
                404: () => (
                    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">We can't find this page</h1>
                        </div>
                        <Link to="/">
                            <Icon name="arrow-left">Back to home</Icon>
                        </Link>
                    </main>
                ),
            }}
        />
    );
}
