import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Function to shut down inactive GPU instances
export async function shutdownInactiveGpus() {
    const toShutDownIds = [];

    // get a list of current instances from vast
    const response = await axios.get('https://console.vast.ai/api/v0/instances', {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });
    const liveInstances = response.data.instances;

    console.log('Live GPU instances', liveInstances.length);

    if (!liveInstances.length) return;

    // We want to delete instances whos IDs aren't linked in our gpu table
    const knownGpus = await prisma.gpu.findMany({
        where: {
            instanceId: {
                in: liveInstances.map((liveInstance: { id: string }) => liveInstance.id.toString()),
            },
        },
    });

    // get a list of liveInstance IDs that aren't in knownGpus
    const unknownGpus = liveInstances
        .filter((liveInstance: { id: string }) => !knownGpus.some((knownGpu) => knownGpu.instanceId === liveInstance.id))
        .map((liveInstance: { id: string }) => liveInstance.id.toString());

    console.log(`Unknown GPU instances: ${unknownGpus.join(',')}`);

    // add the ids to toShutDownIds
    toShutDownIds.push(...unknownGpus);

    // We want to delete those that are linked, but where training has finished
    const finishedTrainings = await prisma.training.findMany({
        where: {
            status: 'completed',
            NOT: {
                gpuId: null,
            },
        },
        include: {
            gpu: true,
        },
    });

    const finishedTrainingIds = finishedTrainings.map((training) => training.gpu?.instanceId);

    console.log(`Complete GPU instances: ${finishedTrainings.join(',')}`);

    // add the ids to toShutDownIds
    toShutDownIds.push(...finishedTrainingIds);

    // We want to delete those where they are linked but training hasn't received an update in more than 10 minutes
    const stalledGpus = await prisma.gpu.findMany({
        where: {
            status: 'running',
            NOT: {
                training: {
                    updatedAt: {
                        gt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
                    },
                },
            },
        },
    });

    const stalledGpuIds = stalledGpus.map((gpu) => gpu.instanceId);

    console.log(`Stalled GPU instances: ${stalledGpuIds.join(',')}`);
    // add the ids to toShutDownIds
    toShutDownIds.push(...stalledGpuIds);

    console.log(`Shutting down inactive GPU instances: ${toShutDownIds.join(', ')}`);

    try {
        for (const gpu of toShutDownIds) {
            console.log(`Shutting down inactive GPU instance: ${gpu}`);

            // delete these gpus from the database
            await prisma.gpu.deleteMany({
                where: { instanceId: gpu.toString() },
            });

            await axios.delete(`https://console.vast.ai/api/v0/instances/${gpu}/`, {
                headers: {
                    Authorization: `Bearer ${process.env.VAST_API_KEY}`,
                },
            });

            // set training using this gpu as onerror
            await prisma.training.updateMany({
                where: {
                    gpuId: gpu.toString(),
                },
                data: {
                    status: 'onerror',
                },
            });

            console.log(`Shut down inactive GPU instance: ${gpu}`);
        }
    } catch (error) {
        console.error('Error shutting down inactive GPUs:', error);
    }
}

cron.schedule('*/5 * * * *', shutdownInactiveGpus); // Run every 5 minutes

console.log('GPU Manager shutdownInactiveGpus job scheduled');
