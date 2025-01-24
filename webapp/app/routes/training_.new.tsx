import { type LoaderFunctionArgs } from 'react-router';

import { requireUserWithPermission } from '~/services/permissions.server.js';

import { TrainingEditor } from '../util/training-editor';

export { action } from '../util/training-editor.server';

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    return { userId };
}

export default TrainingEditor;
