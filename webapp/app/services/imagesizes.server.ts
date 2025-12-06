import { S3Client, PutObjectRequest, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

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
                text: image.text,
                caption: image.caption,
                isResized: false,
            })),
        });
    }
};

export const removeAllImagesFromGroup = async (imageGroupId: string, userId: string, trainingId: string) => {
    // get all the images first so we have their names for deleting from S3
    const images = await prisma.imageSize.findMany({
        where: { imageGroupId },
        select: { image: { select: { name: true } } },
    });

    await prisma.imageSize.deleteMany({
        where: { imageGroupId },
    });

    const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    for (const image of images) {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_MAXRES_BUCKET_NAME!,
                Key: `${userId}/${trainingId}/images/${imageGroupId}/${image.image.name}`,
            }),
        );
    }
};

export const addImageToGroup = async (imageGroupId: string, imageId: string) => {
    const image = await prisma.trainingImage.findUnique({
        where: { id: imageId },
    });

    if (!image) {
        throw new Error('Image not found');
    }

    await prisma.imageSize.upsert({
        where: { imageId_imageGroupId: { imageId, imageGroupId } },
        update: { text: image.text, caption: image.caption, isResized: false },
        create: {
            imageId,
            imageGroupId,
            text: image.text,
            caption: image.caption,
            isResized: false,
        },
    });
};

export const removeImageFromGroup = async (imageGroupId: string, imageId: string, userId: string, trainingId: string) => {
    const image = await prisma.imageSize.findUnique({
        where: { imageId_imageGroupId: { imageId, imageGroupId } },
        select: { image: { select: { name: true } } },
    });

    if (!image) {
        throw new Error('Image not found');
    }

    const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    await prisma.imageSize.delete({
        where: { imageId_imageGroupId: { imageId, imageGroupId } },
    });

    await s3Client.send(
        new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_MAXRES_BUCKET_NAME!,
            Key: `${userId}/${trainingId}/images/${imageGroupId}/${image.image.name}`,
        }),
    );
};

export const setImageCrop = async (imageGroupId: string, imageId: string, crop: { x: number; y: number; width: number; height: number }) => {
    // this sometimes fails?
    try {
        await prisma.imageSize.update({
            where: { imageId_imageGroupId: { imageId, imageGroupId } },
            // important that we reset isResized so that images aren't stuck in their first resizing forever
            data: {
                x: Number(crop.x.toFixed(0)),
                y: Number(crop.y.toFixed(0)),
                width: Number(crop.width.toFixed(1)),
                height: Number(crop.height.toFixed(1)),
                isResized: false,
            },
        });
    } catch (error) {
        console.error(error);
    }
};
