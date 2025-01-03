import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import prisma from '#/prisma/db.server';

const trainingId = 'cm44rrhfa0005gbssbwn2stb6';

const training = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { config: true, gpu: true, ownerId: true },
});

const client = new S3Client({ region: process.env.AWS_REGION });
const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `${training?.ownerId}/${trainingId}/models/nat0-000021.safetensors`,
});
const presignedUrl = await getSignedUrl(client, command, { expiresIn: 60 * 60 * 12 });

console.log(presignedUrl);
