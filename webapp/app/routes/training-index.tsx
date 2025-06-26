import { useEffect } from 'react';
import { data, type LoaderFunctionArgs, Form, NavLink, Outlet, useLoaderData, Link } from 'react-router';
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
import { getThumbnailUrl } from '~/util/misc';
import { IconText } from '~/components/icon-text';

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
        <div className="align-center justify-top mx-auto flex h-full max-h-screen min-h-screen w-full flex-col items-center overflow-y-auto p-6 sm:pt-[20vh]">
            <EmptyState actionUrl="/training/new" noun="Loras" actionText="Create a new lora" ctaText="Create one now" items={trainings} />

            <ul role="list" className="mx-auto w-full max-w-screen-md space-y-8">
                {trainings.map((training) => (
                    <li
                        key={training.id}
                        className="relative justify-between gap-x-6 space-y-4 rounded-xl border border-gray-800 bg-black/20 transition-all hover:border-primary hover:bg-black">
                        <Link to={`/training/${training.id}`} className="flex flex-row p-6">
                            <div className="flex-1 space-y-2">
                                <h2 className="font-semibold leading-6 text-white">{training.name}</h2>
                                <div>
                                    <IconText icon={LightningBoltIcon} text={training.triggerWord} iconalign="center" className="text-yellow-500" />
                                </div>
                                <div>
                                    <IconText
                                        icon={ImageIcon}
                                        text={`${training._count.images} images`}
                                        iconalign="center"
                                        className="text-accent1"
                                    />
                                </div>
                            </div>

                            <div className="flex items-end items-center gap-x-2">
                                <div className="flex justify-center -space-x-3 font-mono text-sm font-bold leading-6 text-white">
                                    {training.images.map((image) => {
                                        return (
                                            <img
                                                // Add key prop to force React to recreate the img element when error state changes
                                                key={`${image.url}`}
                                                src={getThumbnailUrl(thumbnailBucketUrl, image.url, 200)}
                                                width="60"
                                                height="60"
                                                alt=""
                                                className={`m-auto block h-[60px] w-[60px] rounded-full object-cover text-center shadow-lg ring-2 ring-white dark:ring-slate-900`}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
            <Outlet />
        </div>
    );
}
