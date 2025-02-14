import 'dotenv/config';
import { SQS } from '@aws-sdk/client-sqs';

import prisma from '#/prisma/db.server';

const queueUrl = process.env.AWS_SQS_TASK_QUEUE_URL;

const sqs = new SQS({ region: 'us-east-1' });

async function pollMessages(handler: (message: any) => Promise<void>) {
    try {
        const data = await sqs.receiveMessage({
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20, // Long polling
            VisibilityTimeout: 60, // 1 minute
            MessageSystemAttributeNames: ['ApproximateReceiveCount'],
        });

        if (data.Messages) {
            console.log('Messages received:', data.Messages.length);

            for (const message of data.Messages) {
                const { Body, ReceiptHandle, MessageId, Attributes } = message;

                if (!Body) {
                    console.error('No body found in message', MessageId);
                    continue;
                }

                // Process message logic here
                const body = JSON.parse(Body);
                const { trainingId, task } = body;

                // check that another message with this ID hasn't already been processed
                const existingStatus = await prisma.trainingStatus.findFirst({
                    where: { messageId: MessageId },
                });

                if (existingStatus) {
                    console.log('Message already processed', MessageId);
                    continue;
                }

                if (Attributes?.ApproximateReceiveCount && parseInt(Attributes.ApproximateReceiveCount) > 10) {
                    console.log('Message deleted, too stale', MessageId);
                    await sqs.deleteMessage({
                        QueueUrl: queueUrl,
                        ReceiptHandle,
                    });
                    await prisma.trainingStatus.create({
                        data: {
                            status: 'stalled',
                            trainingId,
                        },
                    });
                    continue;
                }

                console.log('Processing message:', Body);

                await handler(body);

                try {
                    await sqs.deleteMessage({
                        QueueUrl: queueUrl,
                        ReceiptHandle,
                    });

                    await prisma.trainingStatus.create({
                        data: {
                            messageId: MessageId,
                            status: task,
                            trainingId,
                        },
                    });
                } catch (error) {
                    console.error('Error deleting message:', error);
                }
            }
        }
    } catch (error) {
        console.error('Error polling messages:', error);
    }
}

export function taskSubscription(func: (message: any) => Promise<void>, interval = 10000) {
    setInterval(() => {
        pollMessages(func);
    }, interval);
}
