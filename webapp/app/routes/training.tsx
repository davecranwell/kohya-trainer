import { useEffect } from 'react';
import { data, type LoaderFunctionArgs, Form, NavLink, Outlet, useLoaderData } from 'react-router';
import { type ActionFunctionArgs } from 'react-router';
import { ImageIcon, LightningBoltIcon, Pencil1Icon, UploadIcon } from '@radix-ui/react-icons';
import { useEventSource } from 'remix-utils/sse/react';
import clsx from 'clsx';

import prisma from '#/prisma/db.server';
import { enqueueTraining } from '#/lib/task.server';

import { requireUserWithPermission } from '~/services/permissions.server';
import { redirectWithToast } from '~/services/toast.server';

import { StatusIndicator, type StatusType } from '~/components/status-indicator';
import { EmptyState } from '~/components/empty-state';
import { Button } from '~/components/button';
import { Progress } from '~/components/progress';

export async function action({ request, params }: ActionFunctionArgs) {
    await requireUserWithPermission(request, 'update:training:own');

    const formData = await request.formData();
    const trainingId = formData.get('trainingId');

    if (typeof trainingId !== 'string') {
        return data({ error: 'Invalid training ID' }, { status: 400 });
    }

    //prevent duplicate tasks
    const training = await prisma.training.findUnique({
        where: { id: trainingId },
    });

    if (training?.status) {
        return data({ error: 'Training already started' }, { status: 400 });
    }

    try {
        const start = await enqueueTraining(trainingId);
        if (start) {
            return redirectWithToast(
                `/training`,
                {
                    type: 'success',
                    title: 'Training started',
                    description: 'Grab a snack and check back in a few minutes.',
                },
                { status: 302 },
            );
        }
    } catch (error) {}
}

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
        orderBy: {
            updatedAt: 'desc',
        },
    });

    return { userId, trainings };
}

export default function TrainingPage() {
    const { userId, trainings } = useLoaderData<typeof loader>();
    const progressMessage = useEventSource(`/sse/${userId}`, { event: userId });

    useEffect(() => {
        if (!progressMessage) return;

        const progressParsed = JSON.parse(progressMessage);
        const key = progressParsed.Key.split('/').pop() || progressParsed.Key;
    }, [progressMessage]);

    return (
        <div>
            {!trainings.length && <EmptyState actionUrl="/training/new" noun="trainings" actionText="Create a new training" ctaText="" />}
            <ul role="list" className="space-y-8 overflow-hidden">
                {trainings.map((training) => (
                    <li
                        key={training.id}
                        className="relative flex flex-col justify-between gap-x-6 space-y-4 rounded-xl border border-gray-800 bg-black/20 p-6 hover:bg-black">
                        <div className="flex w-full">
                            <div className="flex w-full min-w-0 flex-1 flex-col gap-x-4 sm:flex-row">
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
                            </div>
                            <div className={clsx('flex w-full flex-1 flex-row', !training.status && 'items-center justify-end')}>
                                {!training.status ? (
                                    <Form method="POST">
                                        <input type="hidden" name="trainingId" value={training.id} />
                                        <Button variant="default" type="submit">
                                            Start training
                                        </Button>
                                    </Form>
                                ) : (
                                    <div className="flex-auto px-6">
                                        <Progress value={training.status} />
                                    </div>
                                )}
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
