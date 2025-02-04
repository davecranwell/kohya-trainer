import { data, type LoaderFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

export async function loader({ params, request }: LoaderFunctionArgs) {
    await requireUserWithPermission(request, 'create:training:own');

    const training = await prisma.training.findUnique({
        select: {
            config: true,
        },
        where: {
            id: params.id,
        },
    });

    if (!training) {
        throw Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json(JSON.parse(training.config));
}
