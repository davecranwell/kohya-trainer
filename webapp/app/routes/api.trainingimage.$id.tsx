import { S3Client, PutObjectRequest, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl, S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { ActionFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { requireUserWithPermission } from '~/services/permissions.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'update:training:own');
    const trainingId = params.id;
    const data = await request.json();

    if (request.method === 'POST') {
        const newImage = await prisma.trainingImage.create({
            data: {
                text: '',
                url: `https://${process.env.AWS_S3_BUCKET_NAME!}.s3.us-east-1.amazonaws.com/${userId}/${trainingId}/images/${data.name}`,
                name: data.name,
                trainingId: params.id!,
                type: data.type,
            },
        });

        return Response.json(newImage);
    }

    if (request.method === 'PATCH') {
        console.log('herepatch', data.id, data.text);
        const updatedImage = await prisma.trainingImage.update({
            where: { id: data.id },
            data: { text: data.text, updatedAt: new Date() },
        });

        return Response.json(updatedImage);
    }
};
