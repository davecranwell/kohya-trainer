import prisma from '#/prisma/db.server';

export const reduceImageSuccess = async ({ imageId, imageGroupId }: { imageId: string; imageGroupId?: string }) => {
    let imagesRemaining = true;

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

        imagesRemaining = unprocessedImages.length > 0;
        console.log('unprocessed images', unprocessedImages.length);
    } else {
        console.log('updating training image', imageId);
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

        imagesRemaining = unprocessedImages.length > 0;
        console.log('unprocessed images', unprocessedImages.length);
    }

    // if there are no unprocessed images, then we can zip the images
    if (!imagesRemaining) {
        console.log('No unprocessed images remain');
    }

    return imagesRemaining;
};
