import axios from 'axios';
import https from 'https';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import prisma from '#/prisma/db.server';

export const startTraining = async ({ trainingId }: { trainingId: string }) => {
    // Get the training config from the database
    const training = await prisma.training.findUnique({
        where: { id: trainingId },
        select: { config: true, gpu: true, ownerId: true },
    });

    if (!training?.gpu) {
        throw new Error('GPU not assigned to training');
    }

    // Get information from the vast API about the instance using axios
    const vastInstance = await axios.get(`https://console.vast.ai/api/v0/instances/${training.gpu.instanceId}`, {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });

    // NB unusual pluralisation of instances
    const instance = vastInstance?.data?.instances;

    if (!instance) {
        throw new Error(`GPU instance not found on Vast: ${training.gpu.instanceId}`);
    }

    // Get the jupyter_token from the vast API
    // and the mapped port of the kohya instance
    const { jupyter_token: jupyterToken, public_ipaddr: publicIp, ports } = instance;

    if (!ports) {
        throw new Error('Ports not found');
    }

    const kohyaPort = ports['7860/tcp'][0]['HostPort'];

    // Generate a presigned URL for uploading the completed checkpoint files to S3 upon training completion
    const client = new S3Client({ region: process.env.AWS_REGION });
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_UPLOAD_BUCKET_NAME,
        Key: `${training.ownerId}/${trainingId}/models/checkpoint.safetensors`,
    });
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 60 * 60 * 12 }); // upload must occur within 12 hours. Yes this is a long time. TODO: Make this more JIT

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const createTraining = await axios.post(
        `https://${publicIp}:${kohyaPort}/training/?jupyter_token=${jupyterToken}`,
        {
            ...JSON.parse(training.config),
            upload_url: presignedUrl,
        },
        {
            httpsAgent,
        },
    );

    if (createTraining.status !== 201) {
        throw new Error('Failed to create training');
    }

    const startTrainingResponse = await axios.post(
        `https://${publicIp}:${kohyaPort}/training/${createTraining.data.session_id}/start/?jupyter_token=${jupyterToken}`,
        {},
        {
            httpsAgent,
        },
    );

    if (startTrainingResponse.status !== 202) {
        throw new Error('Failed to start training');
    }

    // Update the training with the training id
    await prisma.trainingStatus.create({
        data: {
            trainingId,
            status: 'starting',
        },
    });
};
