import crypto from 'crypto';
import { type ActionFunctionArgs, LoaderFunctionArgs, data } from 'react-router';

import prisma from '#/prisma/db.server';

export async function action({ request, params }: ActionFunctionArgs) {
    const { id } = params;

    if (!id) return;

    // get the training session
    const trainingSession = await prisma.training.findFirst({
        where: {
            id,
        },
    });

    if (!trainingSession) {
        return data({ error: 'Training not found' }, { status: 404 });
    }

    const body = await request.json();

    switch (body.status) {
        case 'image_maxres_resized':
            await prisma.trainingImage.update({
                where: { id: body.imageId },
                data: {
                    isResized: true,
                },
            });
            break;
        case 'downloading_checkpoint_started':
        case 'downloading_checkpoint_progress':
        case 'downloading_checkpoint_completed':
        case 'downloading_images_started':
        case 'downloading_images_progress':
        case 'downloading_images_completed':
        case 'training_starting':
        case 'training_completed':
        case 'training_failed':
            await prisma.trainingStatus.create({
                data: {
                    status: body.status,
                    trainingId: id,
                },
            });
            break;

        case 'training_progress':
            await prisma.trainingStatus.create({
                data: {
                    status: body.status,
                    trainingId: id,
                    // epoch: body.epoch,
                    // step: body.step,
                    // loss: body.loss,
                },
            });
            break;
        default:
            return data({ error: 'Invalid status' }, { status: 400 });
    }

    // update the training session
}

export async function loader({ request }: LoaderFunctionArgs) {
    throw new Response('Not found', { status: 404 });
}
