import { type ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';
import { createTrainingStatus, completeTrainingRun, failTrainingRun } from '~/services/training.server';

export async function action({ request, params }: ActionFunctionArgs) {
    const { runId } = params;

    if (!runId) return;

    // get the training session
    const trainingRun = await prisma.trainingRun.findFirst({
        where: { id: runId },
    });

    if (!trainingRun) {
        return Response.json({ error: 'Training run not found' }, { status: 404 });
    }

    const body = await request.json();

    const bodyJson = JSON.parse(body);

    switch (bodyJson.status) {
        case 'downloading_checkpoint_started':
        case 'downloading_checkpoint_progress':
        case 'downloading_checkpoint_completed':
        case 'downloading_images_started':
        case 'downloading_images_progress':
        case 'downloading_images_completed':
        case 'training_starting':
        case 'training_completed':
        case 'training_progress':
            await createTrainingStatus(runId, bodyJson.status, JSON.stringify(bodyJson));

            break;
        case 'training_failed':
            await createTrainingStatus(runId, bodyJson.status, JSON.stringify(bodyJson));
            await failTrainingRun(runId);

            break;
        case 'completed':
            await completeTrainingRun(runId);
            break;
        default:
            console.error('Invalid status', bodyJson);
            return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    return Response.json({ message: 'Status updated' }, { status: 200 });
}

export async function loader({ request }: LoaderFunctionArgs) {
    throw new Response('Not found', { status: 404 });
}
