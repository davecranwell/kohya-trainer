import { json, type LoaderFunctionArgs, type HeadersFunction, type LinksFunction, type MetaFunction } from '@remix-run/node';
import { Link, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useMatches } from '@remix-run/react';
import { withSentry } from '@sentry/remix';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { HoneypotProvider } from 'remix-utils/honeypot/react';

import appleTouchIconAssetUrl from './assets/favicons/apple-touch-icon.png';
import faviconAssetUrl from './assets/favicons/favicon.svg';

import { GeneralErrorBoundary } from './components/error-boundary.tsx';
import { EpicProgress } from './components/progress-bar.tsx';
import { useToast } from './components/toaster.tsx';
import { href as iconsHref } from './components/ui/icon.tsx';
import { EpicToaster } from './components/ui/sonner.tsx';
import { useTheme } from './routes/resources+/theme-switch.tsx';

import { getUserId, logout } from './utils/auth.server.ts';
import { ClientHintCheck, getHints } from './utils/client-hints.tsx';
import { prisma } from './utils/db.server.ts';
import { getEnv } from './utils/env.server.ts';
import { honeypot } from './utils/honeypot.server.ts';
import { cn, combineHeaders, getDomainUrl } from './utils/misc.tsx';
import { useNonce } from './utils/nonce-provider.ts';
import { type Theme, getTheme } from './utils/theme.server.ts';
import { makeTimings, time } from './utils/timing.server.ts';
import { getToast } from './utils/toast.server.ts';
import { useOptionalUser } from './utils/user.ts';
import Initials from './components/ui/Initials.tsx';

import tailwindStyleSheetUrl from './styles/tailwind.css?url';

const navigation = [{ name: 'Train', href: '/training', current: false }];
const userNavigation = [
    { name: 'Your Profile', href: '/settings/profile' },
    { name: 'Sign out', href: '/logout' },
];

export const links: LinksFunction = () => {
    return [
        // Preload svg sprite as a resource to avoid render blocking
        { rel: 'stylesheet', href: tailwindStyleSheetUrl },
        { rel: 'preload', href: iconsHref, as: 'image' },
        {
            rel: 'icon',
            href: '/favicon.ico',
            sizes: '48x48',
        },
        { rel: 'icon', type: 'image/svg+xml', href: faviconAssetUrl },
        { rel: 'apple-touch-icon', href: appleTouchIconAssetUrl },
        {
            rel: 'manifest',
            href: '/site.webmanifest',
            crossOrigin: 'use-credentials',
        } as const,
    ].filter(Boolean);
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    return [{ title: data ? 'Epic Notes' : 'Error | Epic Notes' }, { name: 'description', content: `Your own captain's log` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
    const timings = makeTimings('root loader');
    const userId = await time(() => getUserId(request), {
        timings,
        type: 'getUserId',
        desc: 'getUserId in root',
    });

    const user = userId
        ? await time(
              () =>
                  prisma.user.findUniqueOrThrow({
                      select: {
                          id: true,
                          name: true,
                          username: true,
                          roles: {
                              select: {
                                  name: true,
                                  permissions: {
                                      select: { entity: true, action: true, access: true },
                                  },
                              },
                          },
                      },
                      where: { id: userId },
                  }),
              { timings, type: 'find user', desc: 'find user in root' },
          )
        : null;
    if (userId && !user) {
        console.info('something weird happened');
        // something weird happened... The user is authenticated but we can't find
        // them in the database. Maybe they were deleted? Let's log them out.
        await logout({ request, redirectTo: '/' });
    }
    const { toast, headers: toastHeaders } = await getToast(request);
    const honeyProps = honeypot.getInputProps();

    return json(
        {
            user,
            requestInfo: {
                hints: getHints(request),
                origin: getDomainUrl(request),
                path: new URL(request.url).pathname,
                userPrefs: {
                    theme: getTheme(request),
                },
            },
            ENV: getEnv(),
            toast,
            honeyProps,
        },
        {
            headers: combineHeaders({ 'Server-Timing': timings.toString() }, toastHeaders),
        },
    );
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
    const headers = {
        'Server-Timing': loaderHeaders.get('Server-Timing') ?? '',
    };
    return headers;
};

function Document({
    children,
    nonce,
    theme = 'light',
    env = {},
    allowIndexing = true,
}: {
    children: React.ReactNode;
    nonce: string;
    theme?: Theme;
    env?: Record<string, string>;
    allowIndexing?: boolean;
}) {
    return (
        <html lang="en" className={`${theme} h-full overflow-x-hidden`} data-theme="nord">
            <head className="h-full" lang="en">
                <ClientHintCheck nonce={nonce} />
                <Meta />
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                {allowIndexing ? null : <meta name="robots" content="noindex, nofollow" />}
                <Links />
            </head>
            <body className="h-full bg-gray-50">
                {children}
                <script
                    nonce={nonce}
                    dangerouslySetInnerHTML={{
                        __html: `window.ENV = ${JSON.stringify(env)}`,
                    }}
                />
                <ScrollRestoration nonce={nonce} />
                <Scripts nonce={nonce} />
            </body>
        </html>
    );
}

function App() {
    const data = useLoaderData<typeof loader>();
    const nonce = useNonce();
    const user = useOptionalUser();
    const theme = useTheme();
    const matches = useMatches();
    const allowIndexing = data.ENV.ALLOW_INDEXING !== 'false';

    const pageHeading = matches.filter((m) => m?.handle?.pageHeading).map((m) => m.handle.pageHeading);

    useToast(data.toast);

    return (
        <Document nonce={nonce} theme={theme} allowIndexing={allowIndexing} env={data.ENV}>
            <div>
                <Disclosure as="nav" className="bg-gray-800">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="flex h-16 items-center justify-between">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <Link to="/">
                                        <img
                                            alt="Your Company"
                                            src="https://tailwindui.com/plus/img/logos/mark.svg?color=indigo&shade=500"
                                            className="h-8 w-8"
                                        />
                                    </Link>
                                </div>
                                <div className="hidden md:block">
                                    <div className="ml-10 flex items-baseline space-x-4">
                                        {navigation.map((item) => (
                                            <a
                                                key={item.name}
                                                href={item.href}
                                                aria-current={item.current ? 'page' : undefined}
                                                className={cn(
                                                    item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                                                    'rounded-md px-3 py-2 font-medium',
                                                )}>
                                                {item.name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="hidden md:block">
                                <div className="ml-4 flex items-center md:ml-6">
                                    {/* <button
                                        type="button"
                                        className="relative rounded-full bg-gray-800 p-1 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                                        <span className="absolute -inset-1.5" />
                                        <span className="sr-only">View notifications</span>
                                        <BellIcon aria-hidden="true" className="h-6 w-6" />
                                    </button> */}

                                    {/* Profile dropdown */}
                                    {user && (
                                        <Menu as="div" className="relative ml-3">
                                            <div>
                                                <MenuButton className="relative flex max-w-xs items-center rounded-full bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                                                    <span className="absolute -inset-1.5" />
                                                    <span className="sr-only">Open user menu</span>
                                                    <Initials name={user.name!} />
                                                    {/* <img alt="" src={user.imageUrl} className="h-8 w-8 rounded-full" /> */}
                                                </MenuButton>
                                            </div>
                                            <MenuItems
                                                transition
                                                className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in">
                                                {userNavigation.map((item) => (
                                                    <MenuItem key={item.name}>
                                                        <a href={item.href} className="block px-4 py-2 text-gray-700 data-[focus]:bg-gray-100">
                                                            {item.name}
                                                        </a>
                                                    </MenuItem>
                                                ))}
                                            </MenuItems>
                                        </Menu>
                                    )}
                                </div>
                            </div>
                            <div className="-mr-2 flex md:hidden">
                                {/* Mobile menu button */}
                                <DisclosureButton className="group relative inline-flex items-center justify-center rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                                    <span className="absolute -inset-0.5" />
                                    <span className="sr-only">Open main menu</span>
                                    <Bars3Icon aria-hidden="true" className="block h-6 w-6 group-data-[open]:hidden" />
                                    <XMarkIcon aria-hidden="true" className="hidden h-6 w-6 group-data-[open]:block" />
                                </DisclosureButton>
                            </div>
                        </div>
                    </div>

                    <DisclosurePanel className="md:hidden">
                        <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
                            {navigation.map((item) => (
                                <DisclosureButton
                                    key={item.name}
                                    as="a"
                                    href={item.href}
                                    aria-current={item.current ? 'page' : undefined}
                                    className={cn(
                                        item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                                        'block rounded-md px-3 py-2 text-base font-medium',
                                    )}>
                                    {item.name}
                                </DisclosureButton>
                            ))}
                        </div>
                        <div className="border-t border-gray-700 pb-3 pt-4">
                            <div className="space-y-1 px-2">
                                {userNavigation.map((item) => (
                                    <DisclosureButton
                                        key={item.name}
                                        as="a"
                                        href={item.href}
                                        className="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white">
                                        {item.name}
                                    </DisclosureButton>
                                ))}
                            </div>
                        </div>
                    </DisclosurePanel>
                </Disclosure>
                <main>
                    {pageHeading.length > 0 && (
                        <header className="bg-white shadow">
                            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                                <h1 className="h1">{pageHeading}</h1>
                            </div>
                        </header>
                    )}
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                        <Outlet />
                    </div>
                </main>
            </div>
            <EpicToaster position="top-center" richColors theme={theme} />
            <EpicProgress />
        </Document>
    );
}

function Logo() {
    return (
        <Link to="/" className="text-2xl font-bold">
            LoraThing
        </Link>
    );
}

function AppWithProviders() {
    const data = useLoaderData<typeof loader>();
    return (
        <HoneypotProvider {...data.honeyProps}>
            <App />
        </HoneypotProvider>
    );
}

export default withSentry(AppWithProviders);

export function ErrorBoundary() {
    // the nonce doesn't rely on the loader so we can access that
    const nonce = useNonce();

    // NOTE: you cannot use useLoaderData in an ErrorBoundary because the loader
    // likely failed to run so we have to do the best we can.
    // We could probably do better than this (it's possible the loader did run).
    // This would require a change in Remix.

    // Just make sure your root route never errors out and you'll always be able
    // to give the user a better UX.

    return (
        <Document nonce={nonce}>
            <GeneralErrorBoundary />
        </Document>
    );
}
