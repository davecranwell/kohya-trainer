import axios from 'axios';
import https from 'https';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import prisma from '#/prisma/db.server';

export const startTraining = async ({ runId }: { runId: string }) => {
    // Get the training config from the database
    const trainingRun = await prisma.trainingRun.findUnique({
        select: {
            gpu: true,
            training: {
                select: {
                    id: true,
                    config: true,
                    ownerId: true,
                },
            },
        },
        where: { id: runId },
    });

    if (!trainingRun) {
        throw new Error('Training run not found');
    }

    const previousStatuses = await prisma.trainingStatus.findMany({
        where: { runId, status: 'startTraining' },
        orderBy: { createdAt: 'asc' },
    });

    if (previousStatuses.length) {
        const oldestStatus = previousStatuses[0];
        const timeDiff = new Date().getTime() - oldestStatus.createdAt.getTime();

        // If the oldest status is older than 10 minutes, set the run to failed
        if (timeDiff > 1000 * 60 * 5) {
            prisma.trainingRun.update({
                where: { id: runId },
                data: { status: 'stalled' },
            });
            throw new Error(`Training could not start after 5 minutes`);
        }
    }

    const { training, gpu } = trainingRun;

    if (!gpu) {
        throw new Error('GPU not assigned to training');
    }

    // Get information from the vast API about the instance using axios
    const vastInstance = await axios.get(`https://console.vast.ai/api/v0/instances/${gpu.instanceId}`, {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });

    // NB unusual pluralisation of instances
    const instance = vastInstance?.data?.instances;

    if (!instance) {
        prisma.trainingRun.update({
            where: { id: runId },
            data: { status: 'failed' },
        });
        throw new Error(`GPU instance not found on Vast: ${gpu.instanceId}`);
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
        Key: `${training.ownerId}/${training.id}/models/checkpoint.safetensors`,
    });
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 60 * 60 * 12 }); // upload must occur within 12 hours. Yes this is a long time. TODO: Make this more JIT

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    try {
        await axios.post(
            `https://${publicIp}:${kohyaPort}/training`,
            {
                ...JSON.parse(training.config),
                id: runId,
                civitai_key: process.env.CIVITAI_KEY,
                upload_url: presignedUrl,
                webhook_url: `${process.env.ROOT_URL}/training/${runId}/webhook`,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jupyterToken}`,
                },
                httpsAgent,
            },
        );
    } catch (error: any) {
        if (error.response.status === 400) {
            throw new Error(`Training could not start: ${error}`);
        }
        return false;
    }

    try {
        await axios.post(
            // same runID as the config above
            `https://${publicIp}:${kohyaPort}/training/${runId}/start`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jupyterToken}`,
                },
                httpsAgent,
            },
        );
    } catch (error: any) {
        console.error('Error starting training:', error);
        return false;
    }

    return true;
};
