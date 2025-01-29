import { SQS } from '@aws-sdk/client-sqs';

import prisma from '#/prisma/db.server';

import { taskSubscription } from './taskQueue';
import { reduceImages } from './tasks/reduceImages';
import { zipImages } from './tasks/zipImages';
import { assignGpuToTraining } from './tasks/createGpuInstance';
import { awaitGpuReady } from './tasks/awaitGpuReady';
import { startTraining } from './tasks/startTraining';

// Add type for the task body
export type TaskBody = {
    task: 'reduceImage' | 'zipImages' | 'allocateGpu' | 'awaitGpuReady' | 'startTraining';
    trainingId: string;
    userId?: string;
    zipKey?: string;
    imageId?: string;
    imageUrl?: string;
};

const sqs = new SQS({ region: 'us-east-1' });

export function subscribeToTasks() {
    console.log('Subscribing to task queue');

    taskSubscription(async (body: TaskBody) => {
        const { task, trainingId, userId }: TaskBody = body;

        switch (task) {
            case 'reduceImages': {
                await reduceImages({ trainingId });
                await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'zipImages', trainingId, userId }, 10);
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
                await assignGpuToTraining({ trainingId });
                await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'awaitGpuReady', trainingId, userId }, 10);
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

export async function createTask(queueUrl: string, messageBody: TaskBody, delaySeconds: number = 0) {
    const { trainingId, task } = messageBody;

    try {
        await sqs.sendMessage({
            DelaySeconds: delaySeconds,
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(messageBody),
        });

        return prisma.training.update({
            where: { id: trainingId },
            data: { status: task, updatedAt: new Date() },
        });
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Call this to begin the async training process
export async function enqueueTraining(trainingId: string) {
    return createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'reduceImages', trainingId });
}
