import prisma from '#/prisma/db.server';

import { createTask } from '../task.server';

export const reduceImages = async ({ runId }: { runId: string }) => {
    console.log('runId', runId);
    const trainingRun = await prisma.trainingRun.findUnique({
        select: {
            trainingId: true,
        },
        where: { id: runId },
    });

    if (!trainingRun) {
        throw new Error('Training run not found');
    }

    // Add all the images to the queue to be resized
    const images = await prisma.trainingImage.findMany({
        where: { trainingId: trainingRun.trainingId, isResized: false },
        select: { id: true, url: true },
    });

    if (images.length < 1) {
        // If no images are unprocesed, go straight to zipping
        return true;
    }

    // add each image to the resize queue
    for (const image of images) {
        createTask(process.env.AWS_SQS_MAXSIZE_QUEUE_URL!, {
            task: 'reduceImage',
            imageId: image.id,
            runId,
            imageUrl: image.url,
        });
    }

    return false;
};
