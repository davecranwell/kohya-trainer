import { useEffect } from 'react';
import { data, type LoaderFunctionArgs, Form, NavLink, Outlet, useLoaderData } from 'react-router';
import { type ActionFunctionArgs } from 'react-router';
import { ImageIcon, LightningBoltIcon, Pencil1Icon, UploadIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';
import type { Route } from './+types/training';

import { useIsPending } from '~/util/hooks';

import { requireUserWithPermission } from '~/services/permissions.server';
import { redirectWithToast } from '~/services/toast.server';
import { beginTraining, checkIncompleteTrainingRun, getAllTrainingsByUser, getTrainingByUser, abortTraining } from '~/services/training.server';

import { StatusIndicator, type StatusType } from '~/components/status-indicator';
import { EmptyState } from '~/components/empty-state';
import { StatusButton } from '~/components/status-button';
import { Button } from '~/components/button';
import { Progress } from '~/components/progress';

const POLL_INTERVAL = 5000;

export async function action({ request, params }: ActionFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'update:training:own');

    const formData = await request.formData();
    const trainingId = formData.get('trainingId');
    const abort = formData.get('abort');

    if (typeof trainingId !== 'string') {
        return data({ error: 'Invalid training ID' }, { status: 400 });
    }

    const training = await getTrainingByUser(trainingId, userId);

    if (!training) {
        return data({ error: 'Training not found' }, { status: 404 });
    }

    if (abort) {
        await abortTraining(trainingId);
        return redirectWithToast(`/training`, { type: 'success', title: 'Training aborted', description: 'Training aborted' });
    }

    if (await checkIncompleteTrainingRun(trainingId)) {
        return data({ error: 'Training already started' }, { status: 400 });
    }

    try {
        if (await beginTraining(training)) {
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

export async function loader({ request }: Route.LoaderArgs) {
    const userId = await requireUserWithPermission(request, 'read:training:own');

    const trainings = await getAllTrainingsByUser(userId);

    return { userId, trainings, thumbnailBucketUrl: `https://${process.env.AWS_S3_THUMBNAILS_BUCKET_NAME!}.s3.us-east-1.amazonaws.com/` };
}

export default function TrainingPage({ loaderData }: Route.ComponentProps) {
    const { userId, trainings, thumbnailBucketUrl } = loaderData;
    const { isPending, pendingFormAction } = useIsPending();

    useEffect(() => {
        const interval = setInterval(async () => {
            const trainingRequest = await fetch(`/api/training`);
            const trainingData = await trainingRequest.json();
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, []);

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
                            <div className={clsx('flex w-full flex-1 flex-row', !training.runs.length && 'items-center justify-end')}>
                                {!training.runs.length ? (
                                    <Form method="POST" action={`/training?trainingId=${training.id}`}>
                                        <input type="hidden" name="trainingId" value={training.id} />
                                        <StatusButton
                                            type="submit"
                                            status={isPending && pendingFormAction == `/training?trainingId=${training.id}` ? 'pending' : 'idle'}>
                                            Start training
                                        </StatusButton>
                                    </Form>
                                ) : (
                                    <div className="flex-auto px-6">
                                        {/* <Progress value={training.runs[0].status} /> */}
                                        <Form method="POST" action={`/training?trainingId=${training.id}`}>
                                            <input type="hidden" name="trainingId" value={training.id} />
                                            <StatusButton
                                                type="submit"
                                                name="abort"
                                                value="true"
                                                status={isPending && pendingFormAction == `/training?trainingId=${training.id}` ? 'pending' : 'idle'}>
                                                Abort training
                                            </StatusButton>
                                        </Form>
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
                                <div className="flex justify-center -space-x-3 font-mono text-sm font-bold leading-6 text-white">
                                    {training.images.map((image) => (
                                        <img
                                            // Add key prop to force React to recreate the img element when error state changes
                                            key={`${image.url}`}
                                            src={`${thumbnailBucketUrl}${image.url}`}
                                            width="50"
                                            height="50"
                                            alt=""
                                            className={`m-auto block h-[50px] w-[50px] rounded-full object-cover text-center shadow-lg ring-2 ring-white dark:ring-slate-900`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
            <Outlet />
        </div>
    );
}
