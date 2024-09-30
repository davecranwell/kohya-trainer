import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { Link, NavLink, Outlet, useLoaderData } from '@remix-run/react';

import { prisma } from '#app/utils/db.server.ts';
import { requireUserWithPermission } from '#app/utils/permissions.server.ts';
import { Icon } from '#app/components/ui/icon.js';

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const trainings = await prisma.training.findMany({
        select: {
            id: true,
            name: true,
        },
        where: {
            ownerId: userId,
        },
    });

    return json({ trainings });
}

export default function TrainingRoute() {
    const data = useLoaderData<typeof loader>();

    return (
        <main className="container flex h-full min-h-[400px] px-0 pb-12 md:px-8">
            <div className="grid w-full grid-cols-4 bg-muted pl-2 md:container md:rounded-3xl md:pr-0">
                <div className="relative col-span-1">
                    <div className="absolute inset-0 flex flex-col">
                        <ul className="overflow-y-auto overflow-x-hidden pb-12">
                            <li className="p-1 pr-0">
                                <NavLink to="/training/new">
                                    <Icon name="plus">New training</Icon>
                                </NavLink>
                            </li>
                            {data.trainings.map((training) => (
                                <li key={training.id} className="p-1 pr-0">
                                    <Link to={`/training/${training.id}`} preventScrollReset>
                                        {training.name}
                                    </Link>
                                    {/* <Link to={`/training/${training.id}/upload`} preventScrollReset prefetch="intent">
                                        <Icon name="image">Images</Icon>
                                    </Link> */}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="relative col-span-3 bg-accent md:rounded-r-3xl">
                    <Outlet />
                </div>
            </div>
        </main>
    );
}
