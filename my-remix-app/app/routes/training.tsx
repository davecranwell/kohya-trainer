import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { NavLink, Outlet, useLoaderData } from '@remix-run/react';
import { ImageIcon, LightningBoltIcon, Pencil1Icon, UploadIcon } from '@radix-ui/react-icons';

import { requireUserWithPermission } from '~/services/permissions.server';
import prisma from '~/services/db.server.js';
import { getThumbnailKey } from '~/util/misc';

import { StatusIndicator, type StatusType } from '~/components/status-indicator';
import { EmptyState } from '~/components/empty-state';
import { Button } from '~/components/button';
import Progress from '~/components/progress';

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'read:training:own');

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

export default function TrainingPage() {
    const data = useLoaderData<typeof loader>();

    return (
        <div>
            {!data.trainings.length && <EmptyState actionUrl="/training/new" noun="trainings" actionText="Create a new training" ctaText="" />}
            <ul role="list" className="space-y-8 overflow-hidden">
                {data.trainings.map((training) => (
                    <li
                        key={training.id}
                        className="relative flex flex-col justify-between gap-x-6 space-y-4 rounded-xl border border-gray-800 bg-black/20 p-6 hover:bg-black">
                        <div className="flex w-full">
                            <div className="flex w-full min-w-0 flex-col gap-x-4 sm:flex-row">
                                <div className="flex-auto">
                                    <h2 className="font-semibold leading-6 text-white">
                                        <NavLink to={`/training/${training.id}`}>
                                            {/* <span className="absolute inset-x-0 -top-px bottom-0" /> */}
                                            {training.name}
                                            <Button variant="ghost" size="icon" className="ml-2 hover:bg-primary">
                                                <Pencil1Icon />
                                            </Button>
                                        </NavLink>
                                    </h2>
                                    <p className="mt-1 flex text-sm leading-5">
                                        <NavLink to={`/training/${training.id}`}>
                                            <LightningBoltIcon className="mr-2 inline text-yellow-500" />
                                            <code className="relative">{training.triggerWord}</code>
                                        </NavLink>
                                    </p>
                                </div>
                                <div className="flex-auto px-6">
                                    <Progress value={training.status} />
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-x-4">
                                <div className="hidden sm:flex sm:flex-col sm:items-end">
                                    <p className="text-sm leading-6 text-gray-900"></p>

                                    <StatusIndicator status={training.status as StatusType} />
                                </div>
                                {/* <ChevronRightIcon aria-hidden="true" className="h-5 w-5 flex-none text-gray-400" /> */}
                            </div>
                        </div>
                        <div className="w-fullitems-center flex justify-between border-t border-gray-800 pt-4">
                            {/* <div className="w-12 flex-none">
                                {training.images.length > 0 && training.images[0]!.url && (
                                        <img
                                            alt=""
                                            src={getThumbnailKey(training.images[0]!.url)}
                                            className="h-12 w-12 flex-none rounded-full bg-gray-50"
                                        />
                                    )}
                                </div> */}
                            <div>
                                <Button variant="ghost" asChild>
                                    <NavLink to={`/training/${training.id}/upload`}>
                                        <UploadIcon className="mr-2" />
                                        Upload
                                    </NavLink>
                                </Button>
                            </div>
                            <div className="flex items-end items-center gap-x-2">
                                <ImageIcon className="text-accent1" />
                                <NavLink to={`/training/${training.id}/upload`}>{training._count.images} images</NavLink>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
            <Outlet />
        </div>
    );
}
