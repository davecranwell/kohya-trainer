import { LoaderFunction } from '@remix-run/node';
import { eventStream } from 'remix-utils/sse/server';

import { emitter } from '#app/utils/emitter.server';
import { requireUserWithPermission } from '#app/utils/permissions.server.js';

export const loader: LoaderFunction = async ({ request, params }) => {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    if (params.userId !== userId) {
        return null;
    }

    return eventStream(request.signal, function setup(send) {
        const handleMessage = (message: string) => {
            send({ event: userId, data: message });
        };

        emitter.on(userId, handleMessage);

        return () => {
            emitter.off(userId, handleMessage);
        };
    });
};
