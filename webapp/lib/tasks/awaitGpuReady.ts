import axios from 'axios';

import prisma from '#/prisma/db.server';
import { SQS } from '@aws-sdk/client-sqs';

export const awaitGpuReady = async ({ trainingId }: { trainingId: string }) => {
    // Get the training config from the database
    const trainingConfig = await prisma.training.findUnique({
        where: { id: trainingId },
        select: { config: true, gpu: true },
    });

    if (!trainingConfig?.gpu) {
        throw new Error('GPU not assigned to training');
    }

    // Get information from the vast API about the instance using axios
    const vastInstance = await axios.get(`https://console.vast.ai/api/v0/instance/${trainingConfig.gpu.instanceId}`, {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });

    if (!vastInstance.data.instance) {
        throw new Error(`GPU instance not found on Vast: ${trainingConfig.gpu.instanceId}`);
    }

    // Get the jupyter_token from the vast API
    // and the mapped port of the kohya instance
    const jupyterToken = vastInstance.data.instance.jupyter_token;
    const kohyaPort = vastInstance.data.instance.ports['7860/tcp'][0]['HostPort'];
    const publicIp = vastInstance.data.instance.public_ipaddr;

    const createTraining = await axios.get(`http://${publicIp}:${kohyaPort}/training/?jupyter_token=${jupyterToken}`);
    return createTraining.status == 200;
};
