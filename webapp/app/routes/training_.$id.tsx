import { data, Outlet, type LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { TrainingEditor } from '~/util/training-editor';
import { type BaseModel, type Training } from '~/types/training';
import { baseModels } from '~/util/difussion-models';
import { Panel } from '~/components/panel';

import { HelpProvider, useHelp } from '~/util/help.provider';
import { clsx } from 'clsx';
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

    return (
        <HelpProvider>
            <div className="max-w-fit overflow-hidden sm:flex sm:h-full sm:min-h-screen sm:flex-row">
                <div className="border-b border-gray-800 sm:w-1/5 sm:min-w-64 sm:border-r">
                    <Panel heading={training.name || 'New training'}>
                        <TrainingEditor key={training.id} training={training as Training & { baseModel: BaseModel }} baseModels={baseModels} />
                    </Panel>
                </div>
                <div className="w-4/5">
                    <Outlet />
                </div>
                <HelpPanel />
            </div>
        </HelpProvider>
    );
}

function HelpPanel() {
    const { help, isOpen } = useHelp();

    return (
        <div
            className={clsx(
                'absolute -right-12 top-0 z-10 min-h-screen w-1/5 border-l border-gray-800 bg-gray-900 shadow-2xl shadow-cyan-500 transition-transform duration-300',
                isOpen ? 'translate-x -right-0' : 'translate-x-full',
            )}>
            <Panel heading="Help">{help}</Panel>
        </div>
    );
}
