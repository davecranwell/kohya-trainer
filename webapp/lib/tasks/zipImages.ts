import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import prisma from '#/prisma/db.server';

export const zipImages = async ({ trainingId }: { trainingId: string }) => {
    const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    const training = await prisma.training.findUnique({
        where: { id: trainingId },
        select: { ownerId: true },
    });

    if (!training?.ownerId) {
        throw new Error('Training not found');
    }

    // upload all the captions from the Images table for this training as .txt files named after their image filenames, to the same location on S3
    const images = await prisma.trainingImage.findMany({
        where: { trainingId },
        select: { text: true, name: true },
    });

    // upload tags to S3
    for (const image of images) {
        if (!image.text) {
            continue;
        }

        await s3Client.send(
            new PutObjectCommand({
                Bucket: process.env.AWS_S3_MAXRES_BUCKET_NAME,
                Key: `${training?.ownerId}/${trainingId}/${image.name}.txt`,
                Body: image.text,
            }),
        );
    }

    // call the lambda function
    const client = new LambdaClient({ region: 'us-east-1' });

    const command = new InvokeCommand({
        FunctionName: process.env.ZIP_IMAGES_LAMBDA_NAME,
        Payload: JSON.stringify({ bucket: process.env.AWS_S3_MAXRES_BUCKET_NAME, key: `${training?.ownerId}/${trainingId}/` }),
    });

    const { Payload, LogResult, StatusCode } = await client.send(command);

    type ZipPayloadResponse = {
        message: string;
        zipKey: string;
    };

    const lambdaResult = Payload && (JSON.parse(Buffer.from(Payload).toString()) as ZipPayloadResponse);

    if (lambdaResult?.zipKey) {
        const training = await prisma.training.findUnique({
            where: { id: trainingId },
            select: { config: true },
        });

        if (training?.config) {
            const configJson = JSON.parse(training.config);
            configJson.training_images_url = lambdaResult.zipKey;

            //update the training config to set training_images_url to the zip key
            await prisma.training.update({
                where: { id: trainingId },
                data: { config: JSON.stringify(configJson) },
            });
        }

        return lambdaResult?.zipKey;
    }
};
