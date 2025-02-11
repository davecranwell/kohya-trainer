import prisma from '#/prisma/db.server';

import { createTask } from '../task.server';

export const reduceImages = async ({ trainingId }: { trainingId: string }) => {
    const training = await prisma.training.findUnique({
        where: { id: trainingId },
        select: { ownerId: true },
    });

    if (!training?.ownerId) {
        throw new Error('Training not found');
    }

    // Add all the images to the queue to be resized
    const images = await prisma.trainingImage.findMany({
        where: { trainingId, isResized: false },
        select: { id: true, url: true },
    });

    if (images.length < 1) {
        // go straight to zipping
        await createTask(process.env.AWS_SQS_TASK_QUEUE_URL!, { task: 'zipImages', trainingId });
        return;
    }

    // add each image to the resize queue
    for (const image of images) {
        createTask(process.env.AWS_SQS_MAXSIZE_QUEUE_URL!, {
            task: 'reduceImage',
            imageId: image.id,
            trainingId,
            imageUrl: image.url,
            webhookUrl: `${process.env.ROOT_URL}/training/${trainingId}/webhook`,
        });
    }
};
