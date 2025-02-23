import { type ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import prisma from '#/prisma/db.server';

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

    switch (body.status) {
        case 'downloading_checkpoint_started':
        case 'downloading_checkpoint_progress':
        case 'downloading_checkpoint_completed':
        case 'downloading_images_started':
        case 'downloading_images_progress':
        case 'downloading_images_completed':
        case 'training_starting':
        case 'training_completed':
        case 'training_failed':
        case 'training_progress':
            await prisma.trainingStatus.create({
                data: {
                    status: body.status,
                    runId,
                },
            });

            break;
        default:
            console.error('Invalid status', body);
            return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    return Response.json({ message: 'Status updated' }, { status: 200 });
}

export async function loader({ request }: LoaderFunctionArgs) {
    throw new Response('Not found', { status: 404 });
}
