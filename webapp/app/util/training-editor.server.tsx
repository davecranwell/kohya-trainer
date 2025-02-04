import { parseWithZod } from '@conform-to/zod';
import { data, type ActionFunctionArgs } from 'react-router';
import { z } from 'zod';

import prisma from '../../prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server.js';
import { redirectWithToast } from '~/services/toast.server';

export const TrainingEditorSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    triggerWord: z.string().min(4).max(10),
    baseModel: z.string().url(),
});

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'update:training:own');
    const formData = await request.formData();

    const submission = await parseWithZod(formData, {
        schema: TrainingEditorSchema.superRefine(async (data, ctx) => {
            if (!data.id) return;

            const note = await prisma.training.findUnique({
                select: { id: true },
                where: { id: data.id, ownerId: userId },
            });
            if (!note) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Training not found',
                });
            }
        }),
        async: true,
    });

    if (submission.status !== 'success') {
        return data({ result: submission.reply() }, { status: submission.status === 'error' ? 400 : 200 });
    }

    const { id: trainingId, name, triggerWord, baseModel } = submission.value;

    const training = await prisma.training.findUnique({
        include: {
            _count: {
                select: { images: true },
            },
        },
        where: { id: trainingId },
    });

    if (!training) {
        throw data('Not found', { status: 404 });
    }

    const TrainingConfig = await import('~/util/training-config.jsonc');

    const config = {
        ...TrainingConfig.default,
        id: trainingId,
        output_name: triggerWord.trim(),
        trigger_word: triggerWord.trim(),
        checkpoint_url: baseModel.trim(),
        checkpoint_filename: 'model.safetensors', // TODO: make this dynamic
        webhook_url: `${process.env.ROOT_URL}/training/${trainingId}/webhook`,
        civitai_key: process.env.CIVITAI_KEY,
        metadata_description: `Training images: ${training?._count.images}. Trigger word(s): ${triggerWord.trim()}. Base model: ${baseModel.trim()}. Trained through: ${process.env.ROOT_URL}`,
        metadata_title: name.trim(),
    };

    const updateTraining = await prisma.training.upsert({
        select: { id: true, owner: { select: { email: true } } },
        where: { id: trainingId ?? '__new_training__' },
        create: {
            ownerId: userId,
            name: name.trim(),
            triggerWord: triggerWord.trim(),
            baseModel: baseModel.trim(),
            config: JSON.stringify(config),
        },
        update: {
            name: name.trim(),
            triggerWord: triggerWord.trim(),
            baseModel: baseModel.trim(),
            config: JSON.stringify(config),
        },
    });

    return redirectWithToast(`/training/${updateTraining.id}/upload`, {
        type: 'success',
        title: 'Success',
        description: trainingId ? 'Training configuration has been updated.' : 'New training has been created.',
    });
}
