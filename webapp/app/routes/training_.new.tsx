import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

import { requireUserWithPermission } from '~/services/permissions.server.js';

import { TrainingEditor } from './training-editor';

export { action } from './training-editor.server';
import { baseModels } from '~/util/difussion-models';
import { Container } from '~/components/container';

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    return { userId, baseModels: baseModels.filter((model) => model.type === process.env.MODELS) };
}

export default function TrainingRoute() {
    const { baseModels } = useLoaderData<typeof loader>();

    return (
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
            <Container>
                <TrainingEditor baseModels={baseModels} />
            </Container>
        </div>
    );
}
