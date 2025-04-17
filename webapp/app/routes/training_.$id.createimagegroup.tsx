import { ActionFunctionArgs, data, redirect, type LoaderFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';
import { redirectWithToast } from '~/services/toast.server';

export async function action({ request, params }: ActionFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'update:training:own');

    const training = await prisma.training.findUnique({
        where: { id: params.id, ownerId: userId },
    });

    if (!training) {
        throw Response.json({ error: 'Not found' }, { status: 404 });
    }

    const imageGroup = await prisma.imageGroup.create({
        data: {
            trainingId: training.id,
            name: 'New Image Group ' + new Date().toISOString(),
        },
    });

    return redirectWithToast(`/training/${training.id}/imagegroup/${imageGroup.id}`, {
        type: 'success',
        title: 'Success',
        description: 'Image group created',
    });
}
