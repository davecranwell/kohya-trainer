import 'dotenv/config';
import { SQS, Message } from '@aws-sdk/client-sqs';

import prisma from '#/prisma/db.server';
import { TrainingTask } from '@prisma/client';

const queueUrl = process.env.AWS_SQS_TASK_QUEUE_URL;

const sqs = new SQS({ region: 'us-east-1' });

export type Task = {
    runId: string;
    unique?: boolean;
};
export type TaskBody = Task & {
    task: 'reduceImages' | 'resizeImages' | 'reduceImageSuccess' | 'zipImages' | 'allocateGpu' | 'awaitGpuReady' | 'startTraining';
    zipKey?: string;
    imageId?: string;
    imageGroupId?: string;
};

export type ResizeBody = Task & {
    task: 'reduceImage' | 'resizeImage';
    imageId?: string;
    imageUrl?: string;
    targetUrl?: string;
    cropX?: number;
    cropY?: number;
    cropWidth?: number;
    cropHeight?: number;
    size?: number;
    imageGroupId?: string;
};

async function pollForMessages() {
    const data = await sqs.receiveMessage({
        QueueUrl: queueUrl,
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeout: 60, // 1 minute
        MessageSystemAttributeNames: ['ApproximateReceiveCount'],
    });

    if (!data.Messages) {
        return false;
    }

    return data.Messages;
}

async function validateMessage(message: Message) {
    const { Body, ReceiptHandle, MessageId, Attributes } = message;

    if (!Body) {
        console.error('No body found in message', MessageId);
        return;
    }

    // Process message logic here
    const body = JSON.parse(Body) as TaskBody | ResizeBody;
    const { runId, task, unique } = body;

    // check that another message with this exact ID hasn't already been processed
    const existingMessageId = await prisma.trainingTask.findFirst({
        where: { messageId: MessageId },
    });

    if (existingMessageId) {
        console.log('Message already processed', MessageId);
        await sqs.deleteMessage({
            QueueUrl: queueUrl,
            ReceiptHandle,
        });
        return;
    }

    if (unique) {
        // Check that a task of this type on this run isn't already known about
        // if it's failed, we don't mind as it can be retried
        const existingStartedTask = await prisma.trainingTask.findFirst({
            where: { runId, task, status: { not: 'failed' } },
        });

        if (existingStartedTask) {
            console.log('Unique task already run', task);
            await sqs.deleteMessage({
                QueueUrl: queueUrl,
                ReceiptHandle,
            });
            return;
        }
    }

    // if the message has been received more than 10 times, it indicates a stale run that should be marked
    if (Attributes?.ApproximateReceiveCount && parseInt(Attributes.ApproximateReceiveCount) > 10) {
        console.log('Message deleted, too stale', MessageId);
        await sqs.deleteMessage({
            QueueUrl: queueUrl,
            ReceiptHandle,
        });
        await prisma.trainingRun.update({
            where: { id: runId },
            data: { status: 'stalled' },
        });

        return;
    }

    return true;
}

async function markSuccessful(message: Message, newTask: TrainingTask) {
    const { Body, ReceiptHandle, MessageId, Attributes } = message;
    const body = JSON.parse(Body!) as TaskBody | ResizeBody;
    const { runId, task, unique } = body;

    await prisma.trainingTask.update({
        where: { id: newTask.id },
        data: { status: `completed`, completedAt: new Date() },
    });

    // update the official log of status updates for this run
    await prisma.trainingStatus.create({
        data: { runId, status: task },
    });

    try {
        await sqs.deleteMessage({
            QueueUrl: queueUrl,
            ReceiptHandle,
        });
    } catch (error) {
        console.error('Error deleting message:', error);
    }
}

async function markFailed(message: Message, newTask: TrainingTask) {
    const { Body, ReceiptHandle, MessageId, Attributes } = message;

    await prisma.trainingTask.update({
        where: { id: newTask.id },
        data: { status: `failed` },
    });

    await sqs.deleteMessage({
        QueueUrl: queueUrl,
        ReceiptHandle,
    });
}

async function processMessages(messages: Message[], customHandler: (message: any) => Promise<void>) {
    console.log('Messages received:', messages.length);

    for (const message of messages) {
        const valid = await validateMessage(message);

        if (!valid) {
            continue;
        }

        const { Body, ReceiptHandle, MessageId, Attributes } = message;
        const body = JSON.parse(Body!) as TaskBody | ResizeBody;
        const { runId, task, unique } = body;

        console.log('Message body:', Body);

        const newTask = await prisma.trainingTask.create({
            data: {
                messageId: MessageId!,
                task,
                runId,
                startedAt: new Date(),
                status: `started`,
            },
        });

        try {
            await customHandler(body);
            await markSuccessful(message, newTask);
        } catch (error: any) {
            await markFailed(message, newTask);

            console.error('Error processing message:', error);
        }
    }
}

export function taskSubscription(customHandler: (message: any) => Promise<void>, interval = 10000) {
    setInterval(async () => {
        const messages = await pollForMessages();
        if (messages) {
            await processMessages(messages, customHandler);
        }
    }, interval);
}

export async function queueTask({
    queueUrl = process.env.AWS_SQS_TASK_QUEUE_URL!,
    messageBody,
    delaySeconds = 0,
}: {
    queueUrl?: string;
    messageBody: TaskBody | ResizeBody;
    delaySeconds?: number;
}) {
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
