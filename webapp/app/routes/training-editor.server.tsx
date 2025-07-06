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

    const updateTraining = await prisma.training.upsert({
        select: { id: true, owner: { select: { email: true } } },
        where: { id: trainingId ?? '__new_training__', ownerId: userId },
        create: {
            ownerId: userId,
            name: name.trim(),
            triggerWord: triggerWord.trim(),
            baseModel: JSON.stringify(baseModel),
            config: JSON.stringify({}),
        },
        update: {
            name: name.trim(),
            triggerWord: triggerWord.trim(),
            baseModel: JSON.stringify(baseModel),
            config: JSON.stringify({}),
        },
    });

    return redirectWithToast(`/training/${updateTraining.id}`, {
        type: 'success',
        title: 'Success',
        description: trainingId ? 'Training configuration has been updated.' : 'New training has been created.',
    });
}
