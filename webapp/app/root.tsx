import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from 'react-router';
import type { LinksFunction, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';

import { useNonce } from '~/util/nonce.provider';
import { useToast } from '~/util/hooks';
import { combineHeaders } from './util/misc';

import { getToast } from '~/services/toast.server';

import { GeneralErrorBoundary } from '~/components/general-error-boundary';
import { TooltipProvider } from '~/components/tooltip';
import { Toaster } from '~/components/toaster';

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
    const { toast, headers: toastHeaders } = await getToast(request);

    return data({ toast }, { headers: combineHeaders(toastHeaders) });
}

export function Layout({ children }: { children: React.ReactNode }) {
    const nonce = useNonce();
    const data = useLoaderData<typeof loader>();
    useToast(data.toast);

    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 text-gray-400">
                <div className="mx-auto w-full max-w-6xl">
                    <TooltipProvider delayDuration={100} skipDelayDuration={500}>
                        <div className="overflow-auto p-8">{children}</div>
                    </TooltipProvider>
                    <ScrollRestoration nonce={nonce} />
                    <Scripts nonce={nonce} />
                    <Toaster
                        position="bottom-center"
                        toastOptions={{
                            unstyled: true,
                            classNames: {
                                error: 'border-semantic-error',
                                success: 'border-semantic-success',
                                warning: 'border-semantic-warning',
                                info: 'border-semantic-info',
                                toast: 'items-start group toast rounded-lg border bg-black/40 p-6 flex gap-2',
                                title: 'group-data-[type="success"]:text-semantic-success group-data-[type="error"]:text-semantic-error group-data-[type="warning"]:text-semantic-warning group-data-[type="info"]:text-semantic-info',
                                description: 'text-white',
                                actionButton: 'bg-zinc-400',
                                cancelButton: 'bg-orange-400',
                                closeButton: 'bg-lime-400',
                                icon: 'm-2 group-data-[type="success"]:text-semantic-success group-data-[type="error"]:text-semantic-error group-data-[type="warning"]:text-semantic-warning group-data-[type="info"]:text-semantic-info',
                            },
                        }}
                        icons={{
                            error: <ExclamationTriangleIcon className="h-6 w-6" />,
                            success: <CheckCircledIcon className="h-6 w-6" />,
                            warning: <ExclamationTriangleIcon className="h-6 w-6" />,
                            info: <InfoCircledIcon className="h-6 w-6" />,
                        }}
                    />
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
