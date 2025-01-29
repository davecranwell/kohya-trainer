import 'dotenv/config';
import { SQS } from '@aws-sdk/client-sqs';

const queueUrl = process.env.AWS_SQS_TASK_QUEUE_URL;

const sqs = new SQS({ region: 'us-east-1' });

async function pollMessages(handler) {
    try {
        const data = await sqs.receiveMessage({
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20, // Long polling
            VisibilityTimeout: 60, // 1 minute
        });

        if (data.Messages) {
            console.log('Messages received:', data.Messages.length);

            for (const message of data.Messages) {
                const { Body, ReceiptHandle } = message;

                console.log('Processing message:', Body);
                // Process message logic here
                if (Body) {
                    await handler(JSON.parse(Body));
                }

                try {
                    await sqs.deleteMessage({
                        QueueUrl: queueUrl,
                        ReceiptHandle,
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

export function taskSubscription(func, interval = 5000) {
    setInterval(() => {
        pollMessages(func);
    }, interval);
}
