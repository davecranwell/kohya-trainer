import { SQS } from '@aws-sdk/client-sqs';

import prisma from '#/prisma/db.server';

import { taskSubscription } from './taskQueue';
import { zipImages } from './tasks/zipImages';
import { assignGpuToTraining } from './tasks/createGpuInstance';
import { awaitGpuReady } from './tasks/awaitGpuReady';
import { startTraining } from './tasks/startTraining';

// Add type for the task body
export type TaskBody = {
    task: 'zipImages' | 'allocateGpu' | 'deallocateGpu' | 'awaitGpuReady' | 'enqueueTraining' | 'startTraining';
    trainingId: string;
    userId?: string;
    zipKey?: string;
};

const sqs = new SQS({ region: 'us-east-1' });

export function subscribeToTasks() {
    console.log('Subscribing to task queue');

    taskSubscription(async (body: TaskBody) => {
        const { task, trainingId, userId }: TaskBody = body;

        switch (task) {
            case 'awaitGpuReady': {
                const isReady = await awaitGpuReady(body);
                if (isReady) {
                    await createTask({ task: 'startTraining', trainingId, userId });
                } else {
                    // if not ready, wait 10 seconds and try again
                    await createTask({ task: 'awaitGpuReady', trainingId, userId }, 10);
                }
                break;
            }

            case 'zipImages': {
                const zipKey = await zipImages(body);
                if (zipKey) {
                    await createTask({ task: 'allocateGpu', trainingId, userId, zipKey });
                }

                break;
            }

            case 'allocateGpu': {
                await assignGpuToTraining(body);
                await createTask({ task: 'awaitGpuReady', trainingId, userId }, 10);
                break;
            }

            // Puts the training into the queue for all these shenanigans
            case 'enqueueTraining': {
                await enqueueTraining(trainingId);
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

async function createTask(messageBody: TaskBody, delaySeconds: number = 0) {
    const { trainingId, task } = messageBody;

    try {
        await sqs.sendMessage({
            DelaySeconds: delaySeconds,
            QueueUrl: process.env.AWS_SQS_QUEUE_URL!,
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
    return createTask({ task: 'zipImages', trainingId });
}
