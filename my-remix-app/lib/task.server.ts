import { SQS } from '@aws-sdk/client-sqs';

import prisma from '#/prisma/db.server';
import { taskSubscription } from '#/lib/taskQueue';
import { zipImages } from '#/lib/tasks/zipImages';
import { assignGpuToTraining } from '#/lib/tasks/createGpuInstance';

// Add type for the task body
type TaskBody = {
    task: 'zipImages' | 'allocateGpu' | 'deallocateGpu';
    trainingId: string;
    userId: string;
    zipKey?: string;
};

const sqs = new SQS({ region: 'us-east-1' });

export function subscribeToTasks() {
    console.log('Subscribing to task queue');

    taskSubscription(async (body: TaskBody) => {
        const { task, trainingId, userId }: TaskBody = body;

        switch (task) {
            case 'zipImages':
                const zipKey = await zipImages(body);
                if (zipKey) {
                    await createTask({ task: 'allocateGpu', trainingId, userId, zipKey });
                }

                break;
            case 'allocateGpu':
                await assignGpuToTraining(body);
                break;
        }
    }, 5000);
}

async function createTask(messageBody: any) {
    const { trainingId, task } = messageBody;

    try {
        await sqs.sendMessage({
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

export async function startTraining(trainingId: string, userId: string) {
    return createTask({ task: 'zipImages', trainingId, userId });
}
