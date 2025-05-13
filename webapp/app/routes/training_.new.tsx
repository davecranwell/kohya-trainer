import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

import { requireUserWithPermission } from '~/services/permissions.server.js';

import { TrainingEditor } from '../util/training-editor';

export { action } from '../util/training-editor.server';
import { baseModels } from '~/util/difussion-models';

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    return { userId, baseModels: baseModels.filter((model) => model.type === process.env.MODELS) };
}

export default function TrainingRoute() {
    const { baseModels } = useLoaderData<typeof loader>();

    return <TrainingEditor baseModels={baseModels} />;
}
