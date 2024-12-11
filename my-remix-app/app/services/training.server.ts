import { SQS } from '@aws-sdk/client-sqs';

import prisma from '../../prisma/db.server';

export async function fetchImages(trainingId: string) {
    // fetching logic...

    createTask({ task: 'fetchModel', trainingId });

    return await prisma.training.update({
        where: { id: trainingId },
        data: { status: 'pendingModel' },
    });
}

export async function allocateGpu(trainingId: string) {
    // allocation logic...

    createTask({ task: 'fetchImages', trainingId });

    return await prisma.training.update({
        where: { id: trainingId },
        data: { status: 'pendingImages' },
    });
}

export async function startTraining(trainingId: string) {
    const nextState = 'zipImages';

    createTask({ task: nextState, trainingId });

    return await prisma.training.update({
        where: { id: trainingId },
        data: { status: nextState },
    });
}

async function createTask(messageBody: any) {
    const sqs = new SQS({ region: 'us-east-1' });

    try {
        const result = await sqs.sendMessage({
            QueueUrl: process.env.AWS_SQS_QUEUE_URL!,
            MessageBody: JSON.stringify(messageBody),
        });
        console.log('Message sent:', result.MessageId);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}
