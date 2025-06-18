import prisma from '#/prisma/db.server';

export const addAllImageToGroup = async (trainingId: string, imageGroupId: string) => {
    const images = await prisma.trainingImage.findMany({
        where: { trainingId },
    });
    if (images.length > 0) {
        await prisma.imageSize.deleteMany({
            where: { imageGroupId },
        });
        await prisma.imageSize.createMany({
            data: images.map((image) => ({
                imageId: image.id,
                imageGroupId,
            })),
        });
    }
};

export const removeAllImagesFromGroup = async (imageGroupId: string) => {
    await prisma.imageSize.deleteMany({
        where: { imageGroupId },
    });
};

export const addImageToGroup = async (imageGroupId: string, imageId: string) => {
    await prisma.imageSize.upsert({
        where: { imageId_imageGroupId: { imageId, imageGroupId } },
        update: {},
        create: {
            imageId,
            imageGroupId,
        },
    });
};

export const removeImageFromGroup = async (imageGroupId: string, imageId: string) => {
    await prisma.imageSize.delete({
        where: { imageId_imageGroupId: { imageId, imageGroupId } },
    });
};

export const setImageCrop = async (imageGroupId: string, imageId: string, crop: { x: number; y: number; width: number; height: number }) => {
    // this sometimes fails?
    try {
        await prisma.imageSize.update({
            where: { imageId_imageGroupId: { imageId, imageGroupId } },
            // important that we reset isResized so that images aren't stuck in their first resizing forever
            data: { x: crop.x, y: crop.y, width: crop.width, height: crop.height, isResized: false },
        });
    } catch (error) {
        console.error(error);
    }
};
