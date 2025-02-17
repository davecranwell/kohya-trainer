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
    runId: string;
    zipKey?: string;
    imageId?: string;
};

export type ResizeBody = {
    task: 'reduceImage';
    runId: string;
    imageId?: string;
    imageUrl?: string;
    webhookUrl?: string;
};

const sqs = new SQS({ region: 'us-east-1' });

export function subscribeToTasks() {
    console.log('Subscribing to task queue');

    taskSubscription(async (body: TaskBody | ResizeBody) => {
        const { task, imageId, runId } = body;

        switch (task) {
            case 'reduceImages': {
                const isAllDone = await reduceImages({ runId });
                if (isAllDone) {
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'zipImages', runId });
                }
                break;
            }

            case 'reduceImageSuccess': {
                if (imageId) {
                    const isAllDone = await reduceImageSuccess({ imageId });
                    if (isAllDone) {
                        await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'zipImages', runId });
                    }
                }
                break;
            }

            case 'zipImages': {
                const zipKey = await zipImages({ runId });
                if (zipKey) {
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'allocateGpu', zipKey, runId });
                }

                break;
            }

            case 'allocateGpu': {
                const isDone = await assignGpuToTraining({ runId });
                if (isDone) {
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'awaitGpuReady', runId }, 10);
                }
                break;
            }

            case 'awaitGpuReady': {
                const isReady = await awaitGpuReady({ runId });
                if (isReady) {
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'startTraining', runId });
                } else {
                    // if not ready, wait 30 seconds and try again
                    await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'awaitGpuReady', runId }, 30);
                }
                break;
            }

            // Actually begins the training through the kohya rest api
            case 'startTraining': {
                await startTraining({ runId });
                break;
            }
        }
    }, 5000);
}

export async function createTask(queueUrl: string, messageBody: TaskBody | ResizeBody, delaySeconds: number = 0) {
    const { task } = messageBody;

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
    const run = await prisma.trainingRun.create({
        data: {
            trainingId,
            status: 'started',
        },
    });

    console.log(run.id);

    return createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'reduceImages', runId: run.id });
}
