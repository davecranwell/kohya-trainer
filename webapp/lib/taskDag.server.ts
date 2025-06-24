import prisma from '#/prisma/db.server';

import { taskSubscription, queueTask, TaskBody, ResizeBody } from './taskQueue';
import { reduceImages } from './tasks/reduceImages';
import { zipImages } from './tasks/zipImages';
import { assignGpuToTraining } from './tasks/createGpuInstance';
import { awaitGpuReady } from './tasks/awaitGpuReady';
import { startTraining } from './tasks/startTraining';
import { reduceImageSuccess } from './tasks/reduceImageSuccess';

export function registerDag() {
    console.log('Subscribing to task queue');

    const handleMessage = async (body: TaskBody | ResizeBody) => {
        const { task, imageId, imageGroupId, runId } = body;

        switch (task) {
            case 'reduceImages': {
                const alreadyReduced = await reduceImages({ runId });
                if (alreadyReduced) {
                    await queueTask({ messageBody: { task: 'zipImages', runId, unique: true } });
                }
                break;
            }

            case 'reduceImageSuccess': {
                if (imageId) {
                    const imagesRemaining = await reduceImageSuccess({ imageId, imageGroupId });
                    if (!imagesRemaining) {
                        await queueTask({ messageBody: { task: 'zipImages', runId, unique: true } });
                    }
                }
                break;
            }

            case 'zipImages': {
                const zipKey = await zipImages({ runId });
                if (zipKey) {
                    await queueTask({ messageBody: { task: 'allocateGpu', runId, unique: true } });
                }

                break;
            }

            case 'allocateGpu': {
                const isDone = await assignGpuToTraining({ runId });
                if (isDone) {
                    await queueTask({ messageBody: { task: 'awaitGpuReady', runId }, delaySeconds: 10 });
                }
                break;
            }

            case 'awaitGpuReady': {
                const isReady = await awaitGpuReady({ runId });
                if (isReady) {
                    await queueTask({ messageBody: { task: 'startTraining', runId, unique: true } });
                } else {
                    // if not ready, wait 30 seconds and try again
                    await queueTask({ messageBody: { task: 'awaitGpuReady', runId }, delaySeconds: 60 });
                }
                break;
            }

            // Actually begins the training through the kohya rest api
            case 'startTraining': {
                const started = await startTraining({ runId });
                if (!started) {
                    await queueTask({ messageBody: { task: 'startTraining', runId, unique: true }, delaySeconds: 20 });
                }
                break;
            }
        }
    };

    taskSubscription(handleMessage, 5000);
}

// Call this to begin the async training process
export async function enqueueTraining(trainingId: string, imageGroupId?: string) {
    const training = await prisma.training.findUnique({
        where: { id: trainingId },
        select: {
            config: true,
        },
    });

    if (!training) {
        throw new Error('Training not found');
    }

    const run = await prisma.trainingRun.create({
        data: {
            trainingId,
            imageGroupId,
            status: 'started',
        },
    });

    return queueTask({ messageBody: { task: 'reduceImages', runId: run.id } });
}
