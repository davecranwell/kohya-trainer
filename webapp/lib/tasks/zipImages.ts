import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import prisma from '#/prisma/db.server';

export const zipImages = async ({ trainingId, userId }: { trainingId: string; userId: string }) => {
    const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

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
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: `${userId}/${trainingId}/${image.name}.txt`,
                Body: image.text,
            }),
        );
    }

    // call the lambda function
    const client = new LambdaClient({ region: 'us-east-1' });

    const command = new InvokeCommand({
        FunctionName: process.env.ZIP_IMAGES_LAMBDA_NAME,
        Payload: JSON.stringify({ bucket: process.env.AWS_S3_BUCKET_NAME, key: `${userId}/${trainingId}/` }),
    });

    const { Payload, LogResult, StatusCode } = await client.send(command);

    type ZipPayloadResponse = {
        message: string;
        zipKey: string;
    };

    const lambdaResult = Payload && (JSON.parse(Buffer.from(Payload).toString()) as ZipPayloadResponse);

    if (lambdaResult?.zipKey) {
        return lambdaResult?.zipKey;
    }
};
