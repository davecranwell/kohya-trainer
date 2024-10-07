import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { NavLink, useLoaderData } from '@remix-run/react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

import { requireUserWithPermission } from '#app/utils/permissions.server.ts';
import { prisma } from '#app/utils/db.server.js';
import { cn, getThumbnailKey } from '#app/utils/misc.js';
import { StatusIndicator, type StatusType } from '#app/components/ui/StatusIndicator.tsx';
import { EmptyState } from '#app/components/ui/empty-state.tsx';

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const trainings = await prisma.training.findMany({
        select: {
            id: true,
            name: true,
            updatedAt: true,
            triggerWord: true,
            baseModel: true,
            status: true,
            images: {
                take: 1,
                select: {
                    url: true,
                },
            },
            _count: {
                select: {
                    images: true,
                },
            },
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
        <div>
            {!data.trainings.length && <EmptyState actionUrl="/training/new" noun="trainings" actionText="Create a new training" ctaText="" />}
            <ul role="list" className="divide-y divide-gray-100 overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
                {data.trainings.map((training) => (
                    <li key={training.id} className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6">
                        <div className="flex min-w-0 gap-x-4">
                            <div className="w-12 flex-none">
                                {training.images.length > 0 && training.images[0]!.url && (
                                    <img
                                        alt=""
                                        src={getThumbnailKey(training.images[0]!.url)}
                                        className="h-12 w-12 flex-none rounded-full bg-gray-50"
                                    />
                                )}
                            </div>
                            <div className="min-w-0 flex-auto">
                                <p className="font-semibold leading-6 text-gray-900">
                                    <NavLink to={`/training/${training.id}`}>
                                        {/* <span className="absolute inset-x-0 -top-px bottom-0" /> */}
                                        {training.name}
                                    </NavLink>
                                </p>
                                <p className="mt-1 flex text-sm leading-5 text-gray-500">
                                    <NavLink to={`/training/${training.id}`}>
                                        <span className="relative">{training.triggerWord}</span>
                                    </NavLink>
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-x-4">
                            <div className="hidden sm:flex sm:flex-col sm:items-end">
                                <p className="text-sm leading-6 text-gray-900">
                                    <NavLink to={`/training/${training.id}/upload`}>{training._count.images} images</NavLink>
                                </p>

                                <StatusIndicator status={training.status as StatusType} />
                            </div>
                            {/* <ChevronRightIcon aria-hidden="true" className="h-5 w-5 flex-none text-gray-400" /> */}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
