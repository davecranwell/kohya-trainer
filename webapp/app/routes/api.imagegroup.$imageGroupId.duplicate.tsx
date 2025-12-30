import { ActionFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { requireUserWithPermission } from '~/services/permissions.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'update:training:own');
    const imageGroupId = params.imageGroupId;

    const imageGroup = await prisma.imageGroup.findUnique({
        where: { id: imageGroupId, training: { ownerId: userId } },
        include: {
            images: true,
        },
    });

    if (!imageGroup) {
        return Response.json({ error: 'Image group not found' }, { status: 404 });
    }

    if (request.method === 'POST') {
        const newImageGroup = await prisma.imageGroup.create({
            data: {
                trainingId: imageGroup.trainingId,
                name: `${imageGroup.name} (Copy)`,
            },
        });

        await prisma.imageSize.createMany({
            data: imageGroup.images.map((image) => ({
                imageId: image.imageId,
                imageGroupId: newImageGroup.id,
                x: image.x,
                y: image.y,
                width: image.width,
                height: image.height,
                text: image.text,
                caption: image.caption,
                isResized: false,
            })),
        });

        return Response.json({ success: true });
    }
};
