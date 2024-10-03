import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireUserWithPermission } from '#app/utils/permissions.server.ts';
import { prisma } from '#app/utils/db.server.js';
import { NavLink, useLoaderData } from '@remix-run/react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { getThumbnailKey } from '#app/utils/misc.js';

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const trainings = await prisma.training.findMany({
        select: {
            id: true,
            name: true,
            updatedAt: true,
            triggerWord: true,
            baseModel: true,
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
            <button
                type="button"
                className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                <svg fill="none" stroke="currentColor" viewBox="0 0 48 48" aria-hidden="true" className="mx-auto h-12 w-12 text-gray-400">
                    <path
                        d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m0-4c0 4.418-7.163 8-16 8S8 28.418 8 24m32 10v6m0 0v6m0-6h6m-6 0h-6"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                <span className="mt-2 block font-semibold text-gray-900">Create a new training</span>
            </button>
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
                                        <span className="absolute inset-x-0 -top-px bottom-0" />
                                        {training.name}
                                    </NavLink>
                                </p>
                                <p className="mt-1 flex text-sm leading-5 text-gray-500">
                                    <span className="relative truncate hover:underline">{training.triggerWord}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-x-4">
                            <div className="hidden sm:flex sm:flex-col sm:items-end">
                                <p className="text-sm leading-6 text-gray-900">{training._count.images} images</p>

                                <div className="mt-1 flex items-center gap-x-1.5">
                                    <div className="flex-none rounded-full bg-emerald-500/20 p-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    </div>
                                    <p className="text-xs leading-5 text-gray-500">Online</p>
                                </div>
                            </div>
                            <ChevronRightIcon aria-hidden="true" className="h-5 w-5 flex-none text-gray-400" />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
