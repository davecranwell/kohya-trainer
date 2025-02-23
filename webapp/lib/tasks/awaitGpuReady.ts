import axios from 'axios';
import https from 'https';

import prisma from '#/prisma/db.server';

export const awaitGpuReady = async ({ runId }: { runId: string }) => {
    // get all previous status messages for this run with the same status
    const previousStatuses = await prisma.trainingStatus.findMany({
        where: { runId, status: 'awaitGpuReady' },
        orderBy: { createdAt: 'asc' },
    });

    if (previousStatuses.length) {
        const oldestStatus = previousStatuses[0];
        const timeDiff = new Date().getTime() - oldestStatus.createdAt.getTime();

        // If the oldest status is older than 15 minutes, set the run to failed
        if (timeDiff > 1000 * 60 * 15) {
            prisma.trainingRun.update({
                where: { id: runId },
                data: { status: 'stalled' },
            });
            throw new Error(`GPU not ready after 15 minutes`);
        }
    }

    // Get the training config from the database
    const trainingRun = await prisma.trainingRun.findUnique({
        select: {
            gpu: true,
        },
        where: { id: runId },
    });

    if (!trainingRun) {
        throw new Error('Training run not found');
    }

    const { gpu } = trainingRun;

    if (!gpu) {
        throw new Error('GPU not assigned to training');
    }

    // Get information from the vast API about the instance using axios
    const vastInstance = await axios.get(`https://console.vast.ai/api/v0/instances/${gpu.instanceId}/`, {
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
    } catch (error: any) {
        if (error.code != 'ECONNREFUSED') {
            console.error('Error checking GPU readiness:', error.message);
        }
        return false;
    }
};
