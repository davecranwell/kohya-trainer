import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const STALL_PERIOD = 15 * 60 * 1000; // 15 minutes

const getLiveInstances = async () => {
    const response = await axios.get('https://console.vast.ai/api/v0/instances', {
        headers: {
            Authorization: `Bearer ${process.env.VAST_API_KEY}`,
        },
    });
    return response.data.instances;
};

const getKnownGpus = async () => {
    const gpus = await prisma.gpu.findMany();
    return gpus.map((gpu) => gpu.instanceId.toString());
};

const getFinishedTrainingInstanceIds = async () => {
    const finishedTrainingRuns = await prisma.trainingRun.findMany({
        select: {
            gpu: true,
        },
        where: {
            status: 'completed',
        },
    });

    return finishedTrainingRuns.map((trainingRun) => trainingRun.gpu?.instanceId);
};

const getEffectivelyStalledTrainingInstanceIds = async () => {
    // find training runs that are not known to be stalled, but haven't received an update
    const stalledTrainingRuns = await prisma.trainingRun.findMany({
        select: {
            gpu: true,
            statuses: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
        where: {
            status: { not: 'stalled' },
            statuses: {
                some: {
                    createdAt: {
                        lte: new Date(Date.now() - STALL_PERIOD),
                    },
                },
            },
            gpu: {
                isNot: null,
            },
        },
    });

    return stalledTrainingRuns.map((trainingRun) => trainingRun.gpu?.instanceId);
};

const getStalledTrainingInstanceIds = async () => {
    const stalledTrainingRuns = await prisma.trainingRun.findMany({
        select: {
            gpu: true,
        },
        where: {
            status: 'stalled',
            gpu: {
                isNot: null,
            },
        },
    });

    return stalledTrainingRuns.map((trainingRun) => trainingRun.gpu?.instanceId);
};

// Function to shut down inactive GPU instances
export async function shutdownInactiveGpus() {
    const toShutDownIds = [];

    // get a list of current instances from vast
    const liveInstances = await getLiveInstances();

    liveInstances.length &&
        console.log(`Live GPU instances: ${liveInstances.length ? liveInstances.map((instance) => instance.id).join(', ') : 'none'}`);

    // We want to delete instances whos IDs aren't linked in our gpu table
    const knownGpus = await getKnownGpus();

    // get a list of liveInstance IDs that aren't in knownGpus
    const unknownGpus = liveInstances
        .filter((liveInstance) => !knownGpus.some((knownGpu) => knownGpu.instanceId.toString() === liveInstance.id.toString()))
        .map((liveInstance) => liveInstance.id.toString());
    unknownGpus.length && console.log(`Unknown GPU instances: ${unknownGpus.length ? unknownGpus.join(',') : 'none'}`);
    toShutDownIds.push(...unknownGpus);

    // We want to delete those that are linked, but where training has finished
    const finishedTrainingInstanceIds = await getFinishedTrainingInstanceIds();
    finishedTrainingInstanceIds.length &&
        console.log(`Complete GPU instances: ${finishedTrainingInstanceIds.length ? finishedTrainingInstanceIds.join(',') : 'none'}`);
    toShutDownIds.push(...finishedTrainingInstanceIds);

    // We want to delete those where they are linked but training hasn't received an update in more than 10 minutes
    const effectivelyStalledGpuIds = await getEffectivelyStalledTrainingInstanceIds();
    effectivelyStalledGpuIds.length &&
        console.log(`Stalled GPU instances: ${effectivelyStalledGpuIds.length ? effectivelyStalledGpuIds.join(',') : 'none'}`);
    toShutDownIds.push(...effectivelyStalledGpuIds);

    // get known stalled gpus
    const stalledGpuIds = await getStalledTrainingInstanceIds();
    stalledGpuIds.length && console.log(`Stalled GPU instances: ${stalledGpuIds.length ? stalledGpuIds.join(',') : 'none'}`);
    toShutDownIds.push(...stalledGpuIds);

    for (const gpu of toShutDownIds) {
        console.log(`Shutting down inactive GPU instance: ${gpu} ...`);
        try {
            await axios.delete(`https://console.vast.ai/api/v0/instances/${gpu}/`, {
                headers: {
                    Authorization: `Bearer ${process.env.VAST_API_KEY}`,
                },
            });
        } catch (error) {
            if (error.response.status !== 404) {
                console.error('Error shutting down inactive GPUs:', error);
            }
        }

        // set training using this gpu as onerror
        await prisma.trainingRun.updateMany({
            where: {
                gpu: {
                    instanceId: gpu.toString(),
                },
            },
            data: {
                status: 'stalled',
            },
        });

        // delete these gpus from the database
        await prisma.gpu.deleteMany({
            where: { instanceId: gpu.toString() },
        });

        console.log(`Shut down inactive GPU instance: ${gpu}`);
    }
}
