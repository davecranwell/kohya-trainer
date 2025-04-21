import prisma from '#/prisma/db.server';

export const reduceImageSuccess = async ({ imageId, imageGroupId }: { imageId: string; imageGroupId?: string }) => {
    let imagesRemaining = 0;

    if (!imageId) {
        throw new Error('Image ID is required');
    }

    if (imageGroupId) {
        const imageSize = await prisma.imageSize.update({
            where: { imageId_imageGroupId: { imageId, imageGroupId } },
            data: { isResized: true },
            select: { imageGroupId: true },
        });

        if (!imageSize?.imageGroupId) {
            throw new Error('Image not found');
        }

        const unprocessedImages = await prisma.imageSize.findMany({
            where: { imageGroupId: imageSize.imageGroupId, isResized: false },
            select: { imageId: true },
        });

        imagesRemaining = unprocessedImages.length;
    } else {
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

        imagesRemaining = unprocessedImages.length;
    }

    // if there are no unprocessed images, then we can zip the images
    if (imagesRemaining < 1) {
        console.log('No unprocessed images', imageId, imagesRemaining);
        return true;
    }

    return imagesRemaining;
};
