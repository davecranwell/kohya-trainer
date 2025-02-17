import { parseWithZod } from '@conform-to/zod';
import { data, useParams, type ActionFunctionArgs } from 'react-router';
import { z } from 'zod';
import { Training } from '@prisma/client';

import prisma from '../../prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server.js';
import { redirectWithToast } from '~/services/toast.server';

import { TrainingEditorSchema } from './training-editor';

export async function action({ request, params }: ActionFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'update:training:own');
    const formData = await request.formData();

    const submission = await parseWithZod(formData, {
        schema: TrainingEditorSchema,
        async: true,
    });

    if (submission.status !== 'success') {
        return data({ result: submission.reply() }, { status: submission.status === 'error' ? 400 : 200 });
    }

    const { id: trainingId, name, triggerWord, baseModel } = submission.value;

    const TrainingConfig = await import('~/util/training-config.jsonc');

    const config = {
        ...TrainingConfig.default,
        id: trainingId,
        output_name: triggerWord.trim(),
        trigger_word: triggerWord.trim(),
        checkpoint_url: baseModel.url.trim(),
        checkpoint_filename: baseModel.filename.trim(),
        civitai_key: process.env.CIVITAI_KEY,
        metadata_description: `Trigger word(s): ${triggerWord.trim()}. Base model: ${baseModel.name} (${baseModel.url}). Trained through: ${process.env.ROOT_URL}`,
        metadata_title: name.trim(),
    };

    const updateTraining = await prisma.training.upsert({
        select: { id: true, owner: { select: { email: true } } },
        where: { id: trainingId ?? '__new_training__', ownerId: userId },
        create: {
            ownerId: userId,
            name: name.trim(),
            triggerWord: triggerWord.trim(),
            baseModel: JSON.stringify(baseModel),
            config: JSON.stringify(config),
        },
        update: {
            name: name.trim(),
            triggerWord: triggerWord.trim(),
            baseModel: JSON.stringify(baseModel),
            config: JSON.stringify(config),
        },
    });

    return redirectWithToast(`/training/${updateTraining.id}/upload`, {
        type: 'success',
        title: 'Success',
        description: trainingId ? 'Training configuration has been updated.' : 'New training has been created.',
    });
}
