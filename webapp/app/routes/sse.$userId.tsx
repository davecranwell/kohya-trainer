import { LoaderFunction } from 'react-router';
import { eventStream } from 'remix-utils/sse/server';

import { emitter } from '~/util/emitter.server';

import { requireUserWithPermission } from '~/services/permissions.server';
import { getTrainingStatusSummaryHashTable } from '~/services/training.server';

export const loader: LoaderFunction = async ({ request, params }) => {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    if (params.userId !== userId) {
        return null;
    }

    const trainingStatuses = await getTrainingStatusSummaryHashTable(userId);

    return eventStream(request.signal, function setup(send) {
        const handleMessage = (message: string) => {
            send({ event: userId, data: message });
        };

        // sent initial statuses
        send({ event: userId, data: JSON.stringify(trainingStatuses) });

        emitter.on(userId, handleMessage);

        return () => {
            emitter.off(userId, handleMessage);
        };
    });
};
