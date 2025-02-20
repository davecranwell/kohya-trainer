import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import prisma from '#/prisma/db.server';

export const zipImages = async ({ runId }: { runId: string }) => {
    const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    const trainingRun = await prisma.trainingRun.findUnique({
        where: { id: runId },
        select: {
            training: {
                select: {
                    id: true,
                    config: true,
                    gpu: true,
                    ownerId: true,
                },
            },
        },
    });

    if (!trainingRun) {
        throw new Error('Training run not found');
    }

    const { training } = trainingRun;

    // upload all the captions from the Images table for this training as .txt files named after their image filenames, to the same location on S3
    const images = await prisma.trainingImage.findMany({
        where: { trainingId: training.id },
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
                Key: `${training?.ownerId}/${training.id}/images/${image.name.replace(/\.[^.]+$/, '.txt')}`,
                Body: image.text,
            }),
        );
    }

    // call the lambda function
    const client = new LambdaClient({ region: 'us-east-1' });

    const command = new InvokeCommand({
        FunctionName: process.env.ZIP_IMAGES_LAMBDA_NAME,
        Payload: JSON.stringify({ bucket: process.env.AWS_S3_MAXRES_BUCKET_NAME, key: `${training?.ownerId}/${training.id}/` }),
    });

    const { Payload, LogResult, StatusCode } = await client.send(command);

    type ZipPayloadResponse = {
        message: string;
        zipKey: string;
    };

    const lambdaResult = Payload && (JSON.parse(Buffer.from(Payload).toString()) as ZipPayloadResponse);

    if (lambdaResult?.zipKey && training?.config) {
        const configJson = JSON.parse(training.config);
        configJson.training_images_url = `https://${process.env.AWS_S3_MAXRES_BUCKET_NAME}.s3.amazonaws.com/${lambdaResult.zipKey}`;

        //update the training config to set training_images_url to the zip key
        await prisma.training.update({
            where: { id: training.id },
            data: { config: JSON.stringify(configJson) },
        });

        return lambdaResult?.zipKey;
    }
};
