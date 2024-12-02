import { json, Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';

import { useNonce } from '~/util/nonce.provider';
import { GeneralErrorBoundary } from '~/components/general-error-boundary';
import { TooltipProvider } from '~/components/tooltip';

import './tailwind.css';

export const links: LinksFunction = () => [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
    },
    {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
    },
];

export async function loader({ request }: LoaderFunctionArgs) {
    return json({});
}

export function Layout({ children }: { children: React.ReactNode }) {
    const nonce = useNonce();

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 text-gray-400">
                <div className="mx-auto w-full max-w-4xl">
                    <TooltipProvider delayDuration={100} skipDelayDuration={500}>
                        <div className="p-8">{children}</div>
                    </TooltipProvider>
                    <ScrollRestoration nonce={nonce} />
                    <Scripts nonce={nonce} />
                </div>
            </body>
        </html>
    );
}

export default function App() {
    return <Outlet />;
}

export function ErrorBoundary() {
    return <GeneralErrorBoundary />;
}
