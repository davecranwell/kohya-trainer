import { type ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { createTrainingStatus, completeTrainingRun, failTrainingRun } from '~/services/training.server';
import { emitter } from '~/util/emitter.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
    const { runId } = params;

    if (!runId) {
        return Response.json({ error: 'Training run not found' }, { status: 404 });
    }

    // get the training session
    const trainingRun = await prisma.trainingRun.findFirst({
        where: { id: runId },
        include: {
            training: true,
        },
    });

    if (!trainingRun) {
        return Response.json({ error: 'Training run not found' }, { status: 404 });
    }

    const body = await request.json();

    switch (body.status) {
        case 'downloading_checkpoint_started':
        case 'downloading_checkpoint_progress':
        case 'downloading_checkpoint_completed':
        case 'downloading_images_started':
        case 'downloading_images_progress':
        case 'downloading_images_completed':
        case 'training_starting':
        case 'training_completed':
        case 'training_progress':
            await createTrainingStatus(runId, body.status, JSON.stringify(body));

            break;
        case 'training_failed':
            await createTrainingStatus(runId, body.status, JSON.stringify(body));
            await failTrainingRun(runId);

            break;
        case 'completed':
            await completeTrainingRun(runId);
            break;
        default:
            console.error('Invalid status', body);
            return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    emitter.emit(
        trainingRun.training.ownerId,
        JSON.stringify({
            trainingId: trainingRun.training.id,
            trainingRunId: runId,
            body,
        }),
    );

    return Response.json({ message: 'Status updated' }, { status: 200 });
};

export async function loader({ request }: LoaderFunctionArgs) {
    throw new Response('Not found', { status: 404 });
}
