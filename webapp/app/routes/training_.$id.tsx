import { data, type LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { TrainingEditor } from '~/util/training-editor';
export { action } from '~/util/training-editor.server';

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
        throw data('Not found', { status: 404 });
    }

    return { training };
}

export default function TrainingRoute() {
    const { training } = useLoaderData<typeof loader>();

    return <TrainingEditor key={training.id} training={training} />;
}
