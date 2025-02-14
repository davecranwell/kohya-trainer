import { SQS } from '@aws-sdk/client-sqs';

import prisma from '#/prisma/db.server';

import { taskSubscription } from './taskQueue';
import { reduceImages } from './tasks/reduceImages';
import { zipImages } from './tasks/zipImages';
import { assignGpuToTraining } from './tasks/createGpuInstance';
import { awaitGpuReady } from './tasks/awaitGpuReady';
import { startTraining } from './tasks/startTraining';
import { reduceImageSuccess } from './tasks/reduceImageSuccess';

export type TaskBody = {
    task: 'reduceImages' | 'reduceImageSuccess' | 'zipImages' | 'allocateGpu' | 'awaitGpuReady' | 'startTraining';
    trainingId: string;
    userId?: string;
    zipKey?: string;
    imageId?: string;
};

export type ResizeBody = {
    task: 'reduceImage';
    trainingId: string;
    userId?: string;
    imageId?: string;
    imageUrl?: string;
    webhookUrl?: string;
};

const sqs = new SQS({ region: 'us-east-1' });

export function subscribeToTasks() {
    console.log('Subscribing to task queue');

    taskSubscription(async (body: TaskBody | ResizeBody) => {
        const { task, trainingId, imageId, userId } = body;

        switch (task) {
            case 'reduceImages': {
                const isAllDone = await reduceImages({ trainingId });
                if (isAllDone) {
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'zipImages', trainingId });
                }
                break;
            }

            case 'reduceImageSuccess': {
                if (imageId) {
                    const isAllDone = await reduceImageSuccess({ imageId });
                    if (isAllDone) {
                        await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'zipImages', trainingId });
                    }
                }
                break;
            }

            case 'zipImages': {
                const zipKey = await zipImages({ trainingId });
                if (zipKey) {
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'allocateGpu', trainingId, userId, zipKey });
                }

                break;
            }

            case 'allocateGpu': {
                const isDone = await assignGpuToTraining({ trainingId });
                if (isDone) {
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'awaitGpuReady', trainingId, userId }, 10);
                }
                break;
            }

            case 'awaitGpuReady': {
                const isReady = await awaitGpuReady({ trainingId });
                if (isReady) {
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'startTraining', trainingId, userId });
                } else {
                    // if not ready, wait 10 seconds and try again
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'awaitGpuReady', trainingId, userId }, 10);
                }
                break;
            }

            // Actually begins the training through the kohya rest api
            case 'startTraining': {
                await startTraining({ trainingId });
                break;
            }
        }
    }, 5000);
}

export async function createTask(queueUrl: string, messageBody: TaskBody | ResizeBody, delaySeconds: number = 0) {
    const { trainingId, task } = messageBody;

    console.log('Creating task', queueUrl, task);

    try {
        await sqs.sendMessage({
            DelaySeconds: delaySeconds,
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(messageBody),
        });
    } catch (error) {
        console.error('Error sending message:', queueUrl, error);
        return false;
    }
}

// Call this to begin the async training process
export async function enqueueTraining(trainingId: string) {
    return createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'reduceImages', trainingId });
}
