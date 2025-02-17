import { LoaderFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { requireUserWithPermission } from '~/services/permissions.server';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'read:training:own');

    const trainings = await prisma.training.findMany({
        select: {
            id: true,
            runs: {
                select: {
                    statuses: {
                        select: {
                            status: true,
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                        take: 1,
                    },
                },
            },
        },

        where: { ownerId: userId },
    });

    if (!trainings) {
        return Response.json({ error: 'Trainings not found' }, { status: 404 });
    }

    return Response.json(trainings);
};
