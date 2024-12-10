import { SQS } from '@aws-sdk/client-sqs';

import prisma from '~/services/db.server';

// allocateGpu
// fetchImages
// fetchModel
// beginTraining
// downloadModel

export async function beginTraining(trainingId: string) {
    // training logic

    return await prisma.training.update({
        where: { id: trainingId },
        data: { status: 'training' },
    });
}

export async function fetchImages(trainingId: string) {
    // fetching logic...

    createTask({ task: 'fetchModel' });

    return await prisma.training.update({
        where: { id: trainingId },
        data: { status: 'pendingModel' },
    });
}

export async function allocateGpu(trainingId: string) {
    // allocation logic...

    createTask({ task: 'fetchImages' });

    return await prisma.training.update({
        where: { id: trainingId },
        data: { status: 'pendingImages' },
    });
}

export async function startTraining(trainingId: string) {
    createTask({ task: 'allocateGpu' });

    return await prisma.training.update({
        where: { id: trainingId },
        data: { status: 'pendingGpu' },
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
