import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import sharp from 'sharp';

/**
 * Lambda function to process image resizing requests from SQS
 * @param {Object} event - The AWS Lambda event object containing SQS records
 * @param {Object[]} event.Records - Array of SQS message records
 * @param {Object} event.Records[].body - The message body containing image processing details
 * @param {string} event.Records[].body.imageId - Unique identifier for the image being processed
 * @param {string} event.Records[].body.runId - Identifier for the training run this image belongs to
 * @param {string} event.Records[].body.imageUrl - S3 key/path of the source image to be processed, must include full filename
 * @param {string} event.Records[].body.targetUrl - S3 key/path where the processed image should be stored, must include full filename
 * @param {float} [event.Records[].body.cropX] - Optional x-coordinate for cropping the image
 * @param {float} [event.Records[].body.cropY] - Optional y-coordinate for cropping the image
 * @param {float} [event.Records[].body.cropWidth] - Optional width for cropping the image
 * @param {float} [event.Records[].body.cropHeight] - Optional height for cropping the image
 * @param {number} [event.Records[].body.size] - Optional max size (any dimension) for the image to be fitted within
 * @returns {Promise<Object>} Response object with status code and message
 */
export const handler = async (event) => {
    const s3 = new S3Client({ region: 'us-east-1' });
    const sqs = new SQSClient({ region: 'us-east-1' });

    // Process each message from the SQS event
    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body);
            const { imageId, imageGroupId, imageUrl, targetUrl, cropX, cropY, cropWidth, cropHeight, size, runId } = message;

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

            // Get original image dimensions
            const metadata = await image.metadata();
            const originalWidth = metadata.width;
            const originalHeight = metadata.height;

            const isCropping = cropX !== undefined && cropY !== undefined && cropWidth !== undefined && cropHeight !== undefined;

            let processedImage = image;

            if (isCropping) {
                // Convert percentages to actual pixel values
                const left = Math.round(originalWidth * (cropX / 100));
                const top = Math.round(originalHeight * (cropY / 100));
                const width = Math.round(originalWidth * (cropWidth / 100));
                const height = Math.round(originalHeight * (cropHeight / 100));

                processedImage = processedImage.rotate().extract({
                    left,
                    top,
                    width,
                    height,
                });
            }

            if (size) {
                // Resize down only, maintaining aspect ratio, fitting within the specified size
                processedImage = processedImage.rotate().resize(size, size, {
                    fit: 'inside',
                    withoutEnlargement: true, // Prevents upscaling
                });
            }

            // rotation without options is essential to apply any exif orientation data
            const newImage = await processedImage.toBuffer();

            await s3.send(
                new PutObjectCommand({
                    Bucket: process.env.TARGET_BUCKET_NAME,
                    Key: targetUrl || imageUrl,
                    Body: newImage,
                    ContentType: imageObject.ContentType,
                    CacheControl: imageObject.CacheControl,
                }),
            );

            await sqs.send(
                new DeleteMessageCommand({
                    QueueUrl: process.env.QUEUE_URL,
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
                        imageGroupId,
                        runId,
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
