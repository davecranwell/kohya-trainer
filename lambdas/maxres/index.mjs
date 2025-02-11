import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import sharp from 'sharp';

export const handler = async (event) => {
    const s3 = new S3Client({ region: 'us-east-1' });
    const sqs = new SQSClient({ region: 'us-east-1' });

    // Process each message from the SQS event
    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body);
            const { imageId, trainingId, imageUrl, webhookUrl } = message;

            // Load the image from S3
            const imageObject = await s3.send(
                new GetObjectCommand({
                    Bucket: process.env.SOURCE_BUCKET_NAME,
                    Key: imageUrl,
                }),
            );
            // We need to await the stream and convert it to a buffer before passing to sharp
            const imageBuffer = await imageObject.Body.transformToByteArray();
            const image = sharp(imageBuffer);

            const sizes = [
                {
                    size: 2048,
                    options: {
                        fit: 'inside',
                        withoutEnlargement: true,
                    },
                    getKey: (key) => key,
                },
            ];

            for (const size of sizes) {
                // https://sharp.pixelplumbing.com/api-resize#resize
                const newImage = await image.resize(size.size, size.size, size.options).toBuffer();

                const key = size.getKey(imageUrl);

                await s3.send(
                    new PutObjectCommand({
                        Bucket: process.env.TARGET_BUCKET_NAME,
                        Key: key,
                        Body: newImage,
                        ContentType: imageObject.ContentType,
                        CacheControl: imageObject.CacheControl,
                    }),
                );
            }

            await sqs.send(
                new DeleteMessageCommand({
                    QueueUrl: process.env.AWS_SQS_MAXSIZE_QUEUE_URL,
                    ReceiptHandle: record.receiptHandle,
                }),
            );

            // After successful processing, send message to task queue
            await sqs.send(
                new SendMessageCommand({
                    QueueUrl: process.env.TASK_QUEUE_URL,
                    MessageBody: JSON.stringify({
                        task: 'reduceImageSuccess',
                        imageId,
                    }),
                }),
            );

            // If we get here, processing was successful and AWS will automatically delete the message
        } catch (error) {
            // Log the error with context
            console.error('Error processing message:', {
                messageId: record.messageId,
                error: error.message,
                stack: error.stack,
            });

            // Re-throw the error so AWS knows this message failed
            // This will prevent the message from being deleted and allow it to be retried
            throw error;
        }
    }

    return {
        statusCode: 200,
        body: 'Image resized successfully',
    };
};
