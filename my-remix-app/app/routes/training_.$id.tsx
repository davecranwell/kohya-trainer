import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

import prisma from '../../prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { TrainingEditor } from '../util/training-editor';

export { action } from '../util/training-editor.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const training = await prisma.training.findFirst({
        select: {
            id: true,
            name: true,
            triggerWord: true,
            baseModel: true,
        },
        where: {
            id: params.id,
            ownerId: userId,
        },
    });

    if (!training) {
        throw json('Not found', { status: 404 });
    }

    return json({ training });
}

export default function TrainingRoute() {
    const { training } = useLoaderData<typeof loader>();

    return <TrainingEditor key={training.id} training={training} />;
}
