import { S3Client, PutObjectRequest, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQS } from '@aws-sdk/client-sqs';
import { getSignedUrl, S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { ActionFunctionArgs, data, LoaderFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { requireUserWithPermission } from '~/services/permissions.server';
import { sanitiseTagString } from '~/util/misc';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'read:training:own');

    const trainings = await prisma.training.findMany({
        select: {
            id: true,
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

        where: { ownerId: userId },
    });

    if (!trainings) {
        return Response.json({ error: 'Trainings not found' }, { status: 404 });
    }

    return Response.json(trainings);
};
