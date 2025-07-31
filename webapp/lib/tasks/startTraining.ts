import axios, { AxiosError } from 'axios';
import https from 'https';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import prisma from '#/prisma/db.server';
import { getInstance } from '../vast.server';

export const startTraining = async ({ runId }: { runId: string }): Promise<boolean> => {
    // Get the training config from the database
    const trainingRun = await prisma.trainingRun.findUnique({
        select: {
            gpu: true,
            imageGroupId: true,
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

    const { training, gpu } = trainingRun;

    if (!gpu) {
        throw new Error('GPU not assigned to training');
    }

    const previousStatuses = await prisma.trainingStatus.findMany({
        where: { runId, status: 'startTraining' },
        orderBy: { createdAt: 'asc' },
    });

    if (previousStatuses.length) {
        const oldestStatus = previousStatuses[0];
        const timeDiff = new Date().getTime() - oldestStatus.createdAt.getTime();

        // If the oldest status is older than 5 minutes, set the run to failed
        if (timeDiff > 1000 * 60 * 5) {
            prisma.trainingRun.update({
                where: { id: runId },
                data: { status: 'stalled' },
            });
            throw new Error(`Training could not start after 5 minutes`);
        }
    }

    // Get information from the vast API about the instance using axios, catch 429 errors
    const vastInstance = await getInstance(gpu.instanceId).catch(function (error) {
        if (error.response.status === 429) {
            console.log('Rate limit exceeded, retrying');
            return false;
        }
        console.error('Error getting vast instance:', error);
        return false;
    });

    // NB unusual pluralisation of instances
    const instance = vastInstance?.data?.instances;
    console.log({ vastInstance });

    if (!instance) {
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
        Key: `${training.ownerId}/${training.id}/models/${runId}/checkpoint.safetensors`,
    });
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 60 * 60 * 12 }); // upload must occur within 12 hours. Yes this is a long time. TODO: Make this more JIT

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    await axios
        .post(
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
        )
        .catch(function (error) {
            const axiosError = error as AxiosError;

            // Rethrow the error if it's a 400 as future calls aren't magically going to be different
            // This is a hard failure scenario.
            if (error.response.status === 400) {
                const customError = new Error(`Training could not start: ${error.response.data?.error}`);
                (customError as any).originalResponse = axiosError.response?.data;
                throw customError;
            }
            return false;
        });

    await axios
        .post(
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
        )
        .catch(function (error) {
            console.error('Error starting training:', error);
            return false;
        });

    return true;
};
