import { S3Client, PutObjectRequest, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQS } from '@aws-sdk/client-sqs';
import { getSignedUrl, S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { ActionFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { requireUserWithPermission } from '~/services/permissions.server';
import { sanitiseTagString } from '~/util/misc';

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'update:training:own');
    const imageGroupId = params.imageGroupId;
    const imageId = params.id;
    const data = await request.json();

    if (!imageGroupId || !imageId) {
        return Response.json({ error: 'Image group or image not found' }, { status: 404 });
    }

    const imageSize = await prisma.imageSize.findUnique({
        where: { imageId_imageGroupId: { imageId, imageGroupId }, AND: { image: { training: { ownerId: userId } } } },
        select: {
            image: {
                select: {
                    training: { select: { triggerWord: true } },
                },
            },
        },
    });

    if (!imageSize) {
        return Response.json({ error: 'Image size not found' }, { status: 404 });
    }

    if (request.method === 'PATCH') {
        const updatedImage = await prisma.imageSize.update({
            where: { imageId_imageGroupId: { imageId, imageGroupId } },
            data: {
                ...(typeof data.text !== 'undefined' ? { text: sanitiseTagString(data.text, imageSize.image.training.triggerWord.split(' ')) } : {}),
                ...(typeof data.caption !== 'undefined' ? { caption: data.caption } : {}),
                isResized: false,
            },
        });

        return Response.json(updatedImage);
    }
};
