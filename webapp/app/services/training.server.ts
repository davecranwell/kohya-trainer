import prisma from '#/prisma/db.server';
import { enqueueTraining } from '#/lib/taskDag.server';
import { Training } from '@prisma/client';

import { shutdownGpu } from '#/lib/vast.server';

const NOT_RUNNING_STATUS = ['stalled', 'failed', 'completed', 'aborted'];
const RUNNING_STATUS = ['started'];

export const getTrainingByUser = async (trainingId: string, userId: string) => {
    return await prisma.training.findUnique({
        where: { id: trainingId, ownerId: userId },
        select: {
            id: true,
            config: true,
        },
    });
};

export const getTrainingByUserWithImageCount = async (trainingId: string, userId: string) => {
    return await prisma.training.findFirst({
        select: {
            id: true,
            name: true,
            triggerWord: true,
            baseModel: true,
            _count: {
                select: {
                    images: true,
                },
            },
        },
        where: {
            id: trainingId,
            ownerId: userId,
        },
    });
};

export type TrainingStatusSummary = {
    id: string;
    runs: { id: string; status: string; imageGroupId: string | null }[];
};

export const getTrainingStatusSummaryHashTable = async (userId: string) => {
    const trainings = await prisma.training.findMany({
        select: {
            id: true,
            runs: {
                select: {
                    id: true,
                    status: true,
                    imageGroupId: true,
                },
                where: {
                    status: {
                        in: RUNNING_STATUS,
                    },
                },
                take: 1,
            },
        },
        where: {
            ownerId: userId,
        },
        orderBy: {
            updatedAt: 'desc',
        },
    });

    return trainings.reduce(
        (acc, training) => {
            acc[training.id] = training;
            return acc;
        },
        {} as Record<string, TrainingStatusSummary>,
    );
};

export const getTrainingStatusSummaryHashTableByTrainingId = async (userId: string, trainingId: string) => {
    const trainings = await prisma.training.findMany({
        select: {
            id: true,
            runs: {
                select: {
                    id: true,
                    status: true,
                    imageGroupId: true,
                },
                where: {
                    status: {
                        in: RUNNING_STATUS,
                    },
                },
                take: 1,
            },
        },
        where: {
            ownerId: userId,
            id: trainingId,
        },
        orderBy: {
            updatedAt: 'desc',
        },
    });

    return trainings.reduce(
        (acc, training) => {
            acc[training.id] = training;
            return acc;
        },
        {} as Record<string, TrainingStatusSummary>,
    );
};

export const getAllTrainingsByUser = async (userId: string) => {
    return await prisma.training.findMany({
        select: {
            id: true,
            name: true,
            triggerWord: true,
            runs: {
                select: {
                    id: true,
                    status: true,
                },
                where: {
                    status: {
                        in: RUNNING_STATUS,
                    },
                },
                take: 1,
            },
            images: {
                take: 3,
                select: {
                    url: true,
                },
            },
            _count: {
                select: {
                    images: true,
                },
            },
        },
        where: {
            ownerId: userId,
        },
        orderBy: {
            updatedAt: 'desc',
        },
    });
};

export const checkIncompleteTrainingRun = async (trainingId: string) => {
    // prevent duplicate tasks
    return await prisma.trainingRun.findFirst({
        where: {
            trainingId,
            status: {
                not: {
                    in: NOT_RUNNING_STATUS,
                },
            },
        },
    });
};

export const beginTraining = async (training: Pick<Training, 'id' | 'config'>, imageGroupId?: string) => {
    // We have to do the jsonc merge here because anywhere else and we have to jump
    // through a crazy number of hoops to support the jsonc import
    const defaultTrainingConfig = await import('~/util/training-config.jsonc');
    const trainingConfig = JSON.parse(training.config);

    await prisma.training.update({
        where: { id: training.id },
        data: {
            config: JSON.stringify({
                ...defaultTrainingConfig.default,
                ...trainingConfig,
            }),
        },
    });

    return await enqueueTraining(training.id, imageGroupId);
};

export const abortTraining = async (trainingId: string) => {
    const trainingRuns = await prisma.trainingRun.findMany({
        where: { trainingId },
        include: {
            gpu: true,
        },
    });

    await prisma.trainingRun.updateMany({
        where: { id: { in: trainingRuns.map((run) => run.id) } },
        data: { status: 'aborted', gpuId: null },
    });

    for (const run of trainingRuns) {
        if (run.gpu?.instanceId) {
            await shutdownGpu(run.gpu.instanceId);
        }
    }
};

export const completeTrainingRun = async (trainingId: string) => {
    await prisma.trainingRun.update({
        where: { id: trainingId },
        data: { status: 'completed', gpuId: null },
    });
};

export const failTrainingRun = async (runId: string) => {
    await prisma.trainingRun.update({
        where: { id: runId },
        data: { status: 'failed', gpuId: null },
    });
};

export const createTrainingStatus = async (runId: string, status: string, dataJson?: string) => {
    await prisma.trainingStatus.create({
        data: {
            runId,
            status,
            dataJson,
        },
    });
};
