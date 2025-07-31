import { S3Client, PutObjectRequest, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

    const training = await prisma.training.findUnique({
        where: { id: trainingId, ownerId: userId },
    });

    if (!training) {
        return Response.json({ error: 'Training not found' }, { status: 404 });
    }

    if (request.method === 'POST') {
        const newImage = await prisma.trainingImage.create({
            data: {
                text: '',
                url: `${userId}/${trainingId}/images/${data.name}`,
                name: data.name,
                trainingId: params.id!,
                type: data.type,
                width: data.width,
                height: data.height,
                id: data.id,
            },
        });

        return Response.json(newImage);
    }

    if (request.method === 'PATCH') {
        const updatedImage = await prisma.trainingImage.update({
            where: { id: data.id },
            data: { text: sanitiseTagString(data.text, training.triggerWord.split(' ')) },
        });

        return Response.json(updatedImage);
    }

    if (request.method === 'DELETE') {
        const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_UPLOAD_BUCKET_NAME!,
                Key: `${userId}/${trainingId}/images/${data.name}`,
            }),
        );

        const deletedImage = await prisma.trainingImage.delete({
            where: { id: data.id },
        });

        return Response.json(deletedImage);
    }
};
