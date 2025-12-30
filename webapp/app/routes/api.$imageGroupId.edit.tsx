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

    const formData = await request.formData();
    const name = formData.get('name') as string;

    const updatedImageGroup = await prisma.imageGroup.update({
        where: { id: imageGroupId },
        data: { name },
    });

    return Response.json({ success: true });
};
