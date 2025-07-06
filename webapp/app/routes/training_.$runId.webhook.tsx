import { type ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import {
    createTrainingStatus,
    completeTrainingRun,
    failTrainingRun,
    getTrainingStatusSummaryHashTableByTrainingId,
    type TrainingStatusSummary,
} from '~/services/training.server';
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

    const bodyRaw = await request.json();
    const body = JSON.parse(bodyRaw);

    switch (body.status) {
        case 'downloading_checkpoint_started':
        case 'downloading_checkpoint_progress':
        case 'downloading_checkpoint_completed':
        case 'downloading_images_started':
        case 'downloading_images_progress':
        case 'downloading_images_completed':
        case 'training_starting':
        case 'training_progress':
        case 'training_completed':
        case 'uploading_started':
        case 'uploading_progress':
        case 'uploading_completed':
            await createTrainingStatus(runId, body.status, JSON.stringify(body));

            break;
        case 'training_failed':
            await createTrainingStatus(runId, body.status, JSON.stringify(body));
            await failTrainingRun(runId);

            break;
        case 'completed': // this is the last stage
            await createTrainingStatus(runId, body.status, JSON.stringify(body));
            await completeTrainingRun(runId);
            break;
        default:
            console.error('Invalid status', body);
            return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updatedStatus = await getTrainingStatusSummaryHashTableByTrainingId(trainingRun.training.ownerId, trainingRun.training.id);
    emitter.emit(trainingRun.training.ownerId, JSON.stringify(updatedStatus));

    return Response.json({ message: 'Status updated' }, { status: 200 });
};

export async function loader({ request }: LoaderFunctionArgs) {
    throw new Response('Not found', { status: 404 });
}
