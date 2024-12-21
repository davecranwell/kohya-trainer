import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

import { requireUserWithPermission } from '~/services/permissions.server.js';

import { TrainingEditor } from '../util/training-editor';

export { action } from '../util/training-editor.server';

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    return json({ userId });
}

export default TrainingEditor;
