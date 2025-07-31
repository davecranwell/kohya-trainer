import prisma from '#/prisma/db.server';
import { modelTypeMetadata } from '~/util/difussion-models';

import { queueTask } from '../taskQueue';

export const reduceImages = async ({ runId }: { runId: string }) => {
    const trainingRun = await prisma.trainingRun.findUnique({
        select: {
            trainingId: true,
            imageGroupId: true,
            training: {
                select: {
                    baseModel: true,
                },
            },
        },
        where: { id: runId },
    });

    if (!trainingRun) {
        throw new Error('Training run not found');
    }

    const MAX_SIZE = modelTypeMetadata[trainingRun.training.baseModel as keyof typeof modelTypeMetadata]?.minResolution || 1024;

    // If the image group is set, only process the images in the image group.
    // Also expect cropping, so send through the x, y, width, height.
    if (trainingRun.imageGroupId) {
        const images = await prisma.imageSize.findMany({
            where: { imageGroupId: trainingRun.imageGroupId, isResized: false },
            select: {
                x: true,
                y: true,
                width: true,
                height: true,
                image: {
                    select: {
                        id: true,
                        url: true,
                    },
                },
            },
        });

        if (images?.length < 1) {
            // If no images are unprocesed, go straight to zipping
            return true;
        }

        for (const image of images) {
            const filename = image.image.url.split('/').pop();
            const restOfPath = image.image.url.split('/').slice(0, -1).join('/');
            const targetUrl = `${restOfPath}/${trainingRun.imageGroupId}/${filename}`;

            queueTask({
                queueUrl: process.env.AWS_SQS_MAXSIZE_QUEUE_URL!,
                messageBody: {
                    task: 'reduceImage',
                    imageId: image.image.id,
                    imageGroupId: trainingRun.imageGroupId ?? undefined,
                    runId,
                    imageUrl: image.image.url,
                    targetUrl,
                    size: MAX_SIZE,
                    cropX: image.x ?? undefined,
                    cropY: image.y ?? undefined,
                    cropWidth: image.width ?? undefined,
                    cropHeight: image.height ?? undefined,
                },
            });
        }
    } else {
        // Add all the "original" images to the queue to be resized
        const images = await prisma.trainingImage.findMany({
            where: { trainingId: trainingRun.trainingId, isResized: false },
            select: { id: true, url: true },
        });

        if (images.length < 1) {
            // If no images are unprocesed, go straight to zipping
            return true;
        }

        for (const image of images) {
            queueTask({
                queueUrl: process.env.AWS_SQS_MAXSIZE_QUEUE_URL!,
                messageBody: {
                    task: 'reduceImage',
                    imageId: image.id,
                    runId,
                    imageUrl: image.url,
                    targetUrl: image.url,
                    size: MAX_SIZE,
                },
            });
        }
    }

    return false;
};
