import { LoaderFunction } from 'react-router';
import { eventStream } from 'remix-utils/sse/server';

import { emitter } from '~/util/emitter.server';
import { requireUserWithPermission } from '~/services/permissions.server';

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
