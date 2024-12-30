import axios from 'axios';

import prisma from '#/prisma/db.server';

export const startTraining = async ({ trainingId }: { trainingId: string }) => {
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
        throw new Error('GPU instance not found on Vast');
    }

    // Get the jupyter_token from the vast API
    // and the mapped port of the kohya instance
    const jupyterToken = vastInstance.data.instance.jupyter_token;
    const kohyaPort = vastInstance.data.instance.ports['7860/tcp'][0]['HostPort'];
    const publicIp = vastInstance.data.instance.public_ipaddr;

    const createTraining = await axios.post(`http://${publicIp}:${kohyaPort}/training/?jupyter_token=${jupyterToken}`, trainingConfig.config);
    if (createTraining.status !== 201) {
        throw new Error('Failed to create training');
    }

    const startTrainingResponse = await axios.post(
        `http://${publicIp}:${kohyaPort}/training/${createTraining.data.session_id}/start/?jupyter_token=${jupyterToken}`,
    );

    if (startTrainingResponse.status !== 202) {
        throw new Error('Failed to start training');
    }

    // Update the training with the training id
    await prisma.training.update({
        where: { id: trainingId },
        data: {
            status: 'starting',
            updatedAt: new Date(),
        },
    });
};
