import prisma from '#/prisma/db.server';

import { createTask } from '../task.server';

export const reduceImageSuccess = async ({ imageId }: { imageId: string }) => {
    const image = await prisma.trainingImage.update({
        where: { id: imageId },
        data: { isResized: true },
        select: { trainingId: true },
    });

    if (!image?.trainingId) {
        throw new Error('Image not found');
    }

    // Add all the images to the queue to be resized
    const unprocessedImages = await prisma.trainingImage.findMany({
        where: { trainingId: image.trainingId, isResized: false },
        select: { id: true },
    });

    // if there are no unprocessed images, then we can zip the images
    if (unprocessedImages.length < 1) {
        console.log('No unprocessed images, zipping', imageId, unprocessedImages);
        return true;
    }

    return false;
};
