import { invariantResponse } from '@epic-web/invariant';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

import { prisma } from '#app/utils/db.server.ts';
import { requireUserWithPermission } from '#app/utils/permissions.server.ts';
import { TrainingEditor } from './__training-editor.tsx';

export { action } from './__training-editor.server.tsx';

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

    invariantResponse(training, 'Not found', { status: 404 });

    return json({ training });
}

export default function TrainingRoute() {
    const { training } = useLoaderData<typeof loader>();

    return <TrainingEditor key={training.id} training={training} />;
}
