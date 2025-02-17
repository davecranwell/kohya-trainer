import axios from 'axios';
import https from 'https';

import prisma from '#/prisma/db.server';

export const awaitGpuReady = async ({ runId }: { runId: string }) => {
    // Get the training config from the database
    const trainingRun = await prisma.trainingRun.findUnique({
        where: { id: runId },
        select: {
            training: {
                select: {
                    id: true,
                    config: true,
                    gpu: true,
                    ownerId: true,
                },
            },
        },
    });

    if (!trainingRun) {
        throw new Error('Training run not found');
    }

    const { training } = trainingRun;

    if (!training?.gpu) {
        throw new Error('GPU not assigned to training');
    }

    // Get information from the vast API about the instance using axios
    const vastInstance = await axios.get(`https://console.vast.ai/api/v0/instances/${training.gpu.instanceId}/`, {
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
        // Ports are not defined when a server hasn't provisioned far enough yet
        return false;
    }

    const kohyaPort = ports['7860/tcp'][0]['HostPort'];

    // Vast uses a self-signed certificate, so we need to ignore the certificate
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    try {
        const ready = await axios.get(`https://${publicIp}:${kohyaPort}/training`, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jupyterToken}`,
            },
            httpsAgent,
        });
        return ready.status == 200;
    } catch (error) {
        console.error('Error checking GPU readiness:', error);
        return false;
    }
};
