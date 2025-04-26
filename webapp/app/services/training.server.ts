import prisma from '#/prisma/db.server';
import { enqueueTraining } from '#/lib/task.server';
import { Training } from '@prisma/client';

export const getTrainingByUser = async (trainingId: string, userId: string) => {
    return await prisma.training.findUnique({
        where: { id: trainingId, ownerId: userId },
        select: {
            id: true,
            config: true,
        },
    });
};

export const getAllTrainingsByUser = async (userId: string) => {
    return await prisma.training.findMany({
        select: {
            id: true,
            name: true,
            updatedAt: true,
            triggerWord: true,
            baseModel: true,
            runs: {
                where: {
                    status: {
                        not: {
                            in: ['stalled', 'onerror', 'completed'],
                        },
                    },
                },
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
                    in: ['stalled', 'onerror', 'completed'],
                },
            },
        },
    });
};

export const beginTraining = async (training: Pick<Training, 'id' | 'config'>, imageGroupId?: string) => {
    // We have to do the jsonc merge here because anywhere else and we have to jump
    // through a crazy number of hoops to support the import
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
