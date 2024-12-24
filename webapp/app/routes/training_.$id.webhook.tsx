import crypto from 'crypto';
import { type ActionFunctionArgs, json } from '@remix-run/node';

import prisma from '#/prisma/db.server';

export async function action({ request, params }: ActionFunctionArgs) {
    const { id } = params;

    // const signature = request.headers.get('x-webhook-signature');
    // const payload = JSON.stringify(request.body);
    // // Compute HMAC to verify
    // const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET!);
    // const computedSignature = hmac.update(payload).digest('hex');
    // if (signature !== computedSignature) {
    //     return json({ error: 'Forbidden' }, { status: 403 });
    // }

    // get the training session
    const trainingSession = await prisma.training.findFirst({
        where: {
            id,
        },
    });

    if (!trainingSession) {
        return json({ error: 'Training not found' }, { status: 404 });
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
            await prisma.training.update({
                where: { id },
                data: {
                    status: body.status,
                    updatedAt: new Date(),
                },
            });
            break;

        case 'training_progress':
            await prisma.training.update({
                where: { id },
                data: {
                    status: body.status,
                    updatedAt: new Date(),
                    // epoch: body.epoch,
                    // step: body.step,
                    // loss: body.loss,
                },
            });
            break;
        default:
            return json({ error: 'Invalid status' }, { status: 400 });
    }

    // update the training session
}
