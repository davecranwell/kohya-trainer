import { parseWithZod } from '@conform-to/zod';
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { z } from 'zod';

import { requireUserWithPermission } from '~/services/permissions.server.js';
import prisma from '~/services/db.server.js';
import { redirectWithToast } from '~/services/toast.server';

import TrainingConfig from '~/util/training-config.json';

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
        return json({ result: submission.reply() }, { status: submission.status === 'error' ? 400 : 200 });
    }

    const { id: trainingId, name, triggerWord, baseModel } = submission.value;

    const config = {
        ...TrainingConfig,
        pretrained_model_name_or_path: baseModel,
        output_name: triggerWord,
    };

    const updateTraining = await prisma.training.upsert({
        select: { id: true, owner: { select: { email: true } } },
        where: { id: trainingId ?? '__new_training__' },
        create: {
            ownerId: userId,
            name,
            triggerWord,
            baseModel,
            config: JSON.stringify(config),
        },
        update: {
            name,
            triggerWord,
            baseModel,
            config: JSON.stringify(config),
        },
    });

    return redirectWithToast(`/training/${updateTraining.id}/upload`, {
        type: 'success',
        title: 'Success',
        description: trainingId ? 'Training configuration has been updated.' : 'New training has been created.',
    });
}
