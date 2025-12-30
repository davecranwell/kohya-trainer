import { ActionFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { requireUserWithPermission } from '~/services/permissions.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'update:training:own');
    const imageGroupId = params.imageGroupId;

    const imageGroup = await prisma.imageGroup.findUnique({
        where: { id: imageGroupId, training: { ownerId: userId } },
    });

    if (!imageGroup) {
        return Response.json({ error: 'Image group not found' }, { status: 404 });
    }

    if (request.method === 'DELETE') {
        await prisma.imageGroup.delete({
            where: { id: imageGroupId },
        });

        return Response.json({ success: true });
    }
};
