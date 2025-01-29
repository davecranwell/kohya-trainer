import { S3Client, PutObjectRequest, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQS } from '@aws-sdk/client-sqs';
import { getSignedUrl, S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { ActionFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { requireUserWithPermission } from '~/services/permissions.server';
import { sanitiseTagString } from '~/util/misc';

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'update:training:own');
    const trainingId = params.id;
    const data = await request.json();

    if (request.method === 'POST') {
        const newImage = await prisma.trainingImage.create({
            data: {
                text: '',
                url: `${userId}/${trainingId}/images/${data.name}`,
                name: data.name,
                trainingId: params.id!,
                type: data.type,
                id: data.id,
            },
        });

        const sqs = new SQS({ region: 'us-east-1' });
        await sqs.sendMessage({
            DelaySeconds: 0,
            QueueUrl: process.env.AWS_SQS_THUMBNAILER_QUEUE_URL!,
            MessageBody: JSON.stringify({
                id: newImage.id,
                key: `${userId}/${trainingId}/images/${data.name}`,
            }),
        });

        return Response.json(newImage);
    }

    if (request.method === 'PATCH') {
        const updatedImage = await prisma.trainingImage.update({
            where: { id: data.id },
            data: { text: sanitiseTagString(data.text), updatedAt: new Date() },
        });

        return Response.json(updatedImage);
    }
};
