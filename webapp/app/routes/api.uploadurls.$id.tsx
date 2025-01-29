import { S3Client, PutObjectRequest, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl, S3RequestPresigner } from '@aws-sdk/s3-request-presigner';
import { ActionFunctionArgs } from 'react-router';

import { requireUserWithPermission } from '~/services/permissions.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const userId = await requireUserWithPermission(request, 'update:training:own');
    const trainingId = params.id;

    const files = await request.json();

    const s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });

    const urls = await Promise.all(
        files.map(async ({ name, type }: { name: string; type: string }) => {
            const command = new PutObjectCommand({
                Bucket: process.env.AWS_S3_UPLOAD_BUCKET_NAME!,
                Key: `${userId}/${trainingId}/images/${name}`,
                ContentType: type,
            });
            return {
                name,
                type,
                uploadUrl: await getSignedUrl(s3Client, command, { expiresIn: 3600 }),
            };
        }),
    );

    return Response.json(urls);
};
