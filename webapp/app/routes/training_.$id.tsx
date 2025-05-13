import { data, type LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { TrainingEditor } from '~/util/training-editor';
import { type BaseModel, type Training } from '~/types/training';
import { baseModels } from '~/util/difussion-models';

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

    const ourBaseModels = baseModels.filter((model) => model.type === process.env.MODELS);

    if (training.baseModel) {
        const currentBaseModel = JSON.parse(training.baseModel as string);
        training.baseModel = currentBaseModel;

        if (!ourBaseModels.find((model) => model.id === currentBaseModel?.id)) {
            ourBaseModels.push(currentBaseModel);
        }
    }

    return { training, baseModels: ourBaseModels };
}

export default function TrainingRoute() {
    const { training, baseModels } = useLoaderData<typeof loader>();

    return <TrainingEditor key={training.id} training={training as Training & { baseModel: BaseModel }} baseModels={baseModels} />;
}
