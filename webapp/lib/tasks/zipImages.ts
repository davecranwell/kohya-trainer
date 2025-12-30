import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import prisma from '#/prisma/db.server';
import { modelTypeMetadata } from '~/util/difussion-models';

type ZipPayloadResponse = {
    message: string;
    zipKey: string;
};

export const zipImages = async ({ runId }: { runId: string }) => {
    const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    const trainingRun = await prisma.trainingRun.findUnique({
        select: {
            imageGroupId: true,
            training: {
                select: {
                    id: true,
                    baseModel: true,
                    triggerWord: true,
                    config: true,
                    ownerId: true,
                },
            },
        },
        where: { id: runId, status: 'started' },
    });

    if (!trainingRun) {
        throw new Error('Training run not found');
    }

    const { training } = trainingRun;

    const textMode = modelTypeMetadata[JSON.parse(training.baseModel as string)?.type as keyof typeof modelTypeMetadata]?.textMode || 'tags';

    const images = trainingRun.imageGroupId
        ? (
              await prisma.imageSize.findMany({
                  where: { imageGroupId: trainingRun.imageGroupId },
                  select: { text: true, caption: true, image: { select: { name: true, caption: true, text: true } } },
              })
          ).map((image) => ({
              imageSizeText: image.text,
              imageSizeCaption: image.caption,
              originalImageText: image.image.text,
              originalImageCaption: image.image.caption,
              name: image.image.name,
          }))
        : (
              await prisma.trainingImage.findMany({
                  where: { trainingId: training.id },
                  select: { text: true, caption: true, name: true },
              })
          ).map((image) => ({
              imageSizeText: image.text,
              imageSizeCaption: image.caption,
              originalImageText: image.text,
              originalImageCaption: image.caption,
              name: image.name,
          }));

    // upload tags to S3
    for (const image of images) {
        const text = image.imageSizeText === null ? image.originalImageText : image.imageSizeText;
        const caption = image.imageSizeCaption === null ? image.originalImageCaption : image.imageSizeCaption;

        if (!(text?.length || 0 > 0) && !(caption?.length || 0 > 0)) {
            continue;
        }

        await s3Client.send(
            new PutObjectCommand({
                Bucket: process.env.AWS_S3_MAXRES_BUCKET_NAME,
                Key: `${training.ownerId}/${training.id}/images/${trainingRun.imageGroupId ? `${trainingRun.imageGroupId}/` : ''}${image.name.replace(/\.[^.]+$/, '.txt')}`,
                Body: textMode === 'tags' ? `${training.triggerWord},${text}` : (caption || '').replace('[trigger]', training.triggerWord),
            }),
        );
    }

    // call the lambda function
    const client = new LambdaClient({ region: 'us-east-1' });

    const command = new InvokeCommand({
        FunctionName: process.env.ZIP_IMAGES_LAMBDA_NAME,
        Payload: JSON.stringify({
            bucket: process.env.AWS_S3_MAXRES_BUCKET_NAME,
            key: `${training?.ownerId}/${training.id}/images/${trainingRun.imageGroupId ? `${trainingRun.imageGroupId}/` : ''}`,
        }),
    });

    const { Payload, LogResult, StatusCode } = await client.send(command);

    const lambdaResult = Payload && (JSON.parse(Buffer.from(Payload).toString()) as ZipPayloadResponse);

    if (!lambdaResult?.zipKey) {
        throw new Error('Failed to zip images');
    }

    if (training?.config) {
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
