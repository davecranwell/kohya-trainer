import { data, Link, Outlet, type LoaderFunctionArgs } from 'react-router';
import { Form, useLoaderData } from 'react-router';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { TrainingEditor } from '~/routes/training-editor';
import { type BaseModel, type Training } from '~/types/training';
import { baseModels } from '~/util/difussion-models';
import { Panel } from '~/components/panel';

import { HelpProvider, useHelp } from '~/util/help.provider';
import { clsx } from 'clsx';
import { ImagegroupList } from '~/components/imagegroup-list';
import { Button } from '~/components/button';

export { action } from '~/routes/training-editor.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const training = await prisma.training.findFirst({
        select: {
            id: true,
            name: true,
            triggerWord: true,
            baseModel: true,
            _count: {
                select: {
                    images: true,
                },
            },
        },
        where: {
            id: params.id,
            ownerId: userId,
        },
    });

    if (!training) {
        throw data('Not found', { status: 404 });
    }

    const imageGroups = await prisma.imageGroup.findMany({
        include: {
            _count: {
                select: {
                    images: true,
                },
            },
        },
        where: { trainingId: params.id },
    });

    const ourBaseModels = baseModels.filter((model) => model.type === process.env.MODELS);

    if (training.baseModel) {
        const currentBaseModel = JSON.parse(training.baseModel as string);
        training.baseModel = currentBaseModel;

        if (!ourBaseModels.find((model) => model.id === currentBaseModel?.id)) {
            ourBaseModels.push(currentBaseModel);
        }
    }

    return { training, baseModels: ourBaseModels, imageGroups };
}

export default function TrainingRoute() {
    const { training, baseModels, imageGroups } = useLoaderData<typeof loader>();

    return (
        <div className="sm:flex sm:h-full sm:min-h-screen sm:flex-row sm:overflow-hidden">
            <div className="flex-0 max-h-screen overflow-y-auto border-b border-gray-800 sm:w-1/5 sm:min-w-[400px] sm:border-r">
                <Panel heading={training.name || 'New training'}>
                    <TrainingEditor key={training.id} training={training as Training & { baseModel: BaseModel }} baseModels={baseModels} />
                </Panel>
                <Panel heading="Image sets" className="border-t border-gray-800 pt-4">
                    {imageGroups.length > 0 && (
                        <ul className="-mx-6 list-none text-sm leading-6 marker:text-accent1">
                            <li key={'originals'} className={'flex flex-row items-center justify-between hover:hover:bg-primary-dark'}>
                                <Link to={`/training/${training.id}`} className="px-4 py-2 text-white">
                                    Original images
                                </Link>
                                <span className="px-4 py-2">({training._count.images})</span>
                            </li>
                            {imageGroups.map((group) => (
                                <li key={group.id} className={'flex flex-row items-center justify-between hover:hover:bg-primary-dark'}>
                                    <Link to={`/training/${training.id}/imagegroup/${group.id}`} className="px-4 py-2 text-white">
                                        {group.name}
                                    </Link>
                                    <span className="px-4 py-2">({group._count.images})</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <Form action={`/training/${training.id}/createimagegroup`} method="post">
                        <Button variant="secondary" size="full" className="mb-4">
                            Create new image set
                        </Button>
                    </Form>
                </Panel>
            </div>
            <div className="w-4/5 flex-1">
                <Outlet />
            </div>
            <HelpPanel />
        </div>
    );
}

function HelpPanel() {
    const { help, isOpen } = useHelp();

    return (
        <div
            className={clsx(
                'absolute -right-12 top-0 z-10 min-h-screen w-1/5 border-l border-gray-800 bg-gray-900 shadow-2xl shadow-black transition-transform duration-300',
                isOpen ? 'translate-x right-0' : 'translate-x-full',
            )}>
            <Panel heading="Help" className="max-h-screen overflow-y-auto">
                {help}
            </Panel>
        </div>
    );
}
