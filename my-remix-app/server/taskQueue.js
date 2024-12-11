import 'dotenv/config';
import { SQS } from '@aws-sdk/client-sqs';

const queueUrl = process.env.AWS_SQS_QUEUE_URL;

const sqs = new SQS({ region: 'us-east-1' });

async function pollMessages(handler) {
    try {
        const data = await sqs.receiveMessage({
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20, // Long polling
            VisibilityTimeout: 60, // 1 minute
        });

        if (data.Messages) {
            for (const message of data.Messages) {
                // Process message logic here
                await handler(JSON.parse(message.Body));

                try {
                    await sqs.deleteMessage({
                        QueueUrl: queueUrl,
                        ReceiptHandle: message.ReceiptHandle,
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
