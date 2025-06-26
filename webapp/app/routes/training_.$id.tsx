import { data, Link, Outlet, type LoaderFunctionArgs } from 'react-router';
import { Form, useLoaderData } from 'react-router';
import { clsx } from 'clsx';
import { InfoCircledIcon } from '@radix-ui/react-icons';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { TrainingEditor } from '~/routes/training-editor';
import { type BaseModel, type Training } from '~/types/training';
import { baseModels } from '~/util/difussion-models';
import { useHelp } from '~/util/help.provider';

import { Panel } from '~/components/panel';
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
    const { setHelp } = useHelp();
    const { training, baseModels, imageGroups } = useLoaderData<typeof loader>();

    return (
        <div className="sm:flex sm:h-full sm:min-h-screen sm:flex-row sm:overflow-hidden">
            <div className="flex-0 max-h-screen border-b border-gray-800 sm:w-1/5 sm:min-w-[400px] sm:border-r">
                <Panel heading={training.name || 'New training'} classes="h-full">
                    <TrainingEditor key={training.id} training={training as Training & { baseModel: BaseModel }} baseModels={baseModels} />

                    <div className="mt-8 space-y-4 border-t border-gray-800 pt-8">
                        <h2 className="flex flex-row items-center justify-between text-xl">
                            <span>Image sets</span>
                            <Button
                                variant="textonly"
                                size="text"
                                icon={InfoCircledIcon}
                                className="text-sm text-semantic-info"
                                onClick={() => {
                                    setHelp(
                                        <>
                                            <p>
                                                Image sets provide flexible control over which images are used in training your Lora and how those
                                                images are cropped and shaped. You can experiment with different subsets of images without requiring
                                                you to create a brand new training. Images can be included or excluded from an image set individually,
                                                so you can tweak the effect of specific images on your training results.
                                            </p>
                                            <h3 className="font-medium text-gray-300">Cropping images</h3>
                                            <p>
                                                Using <kbd className="rounded border border-gray-600 bg-gray-700 px-1 py-0.5 shadow-sm">⌘</kbd> +
                                                scrollwheel or{' '}
                                                <kbd className="rounded border border-gray-600 bg-gray-700 px-1 py-0.5 shadow-sm">Ctrl</kbd> +
                                                scrollwheel, or two fingers, you can zoom your images to crop them to a specific area, to refine how
                                                your Lora focuses on each image.
                                            </p>
                                        </>,
                                    );
                                }}>
                                About Image Sets
                            </Button>
                        </h2>
                        {imageGroups.length > 0 && (
                            <ul className="-mx-4 list-none text-sm leading-6 marker:text-accent1">
                                <li key={'originals'} className={'hover:hover:bg-primary-dark'}>
                                    <Link to={`/training/${training.id}`} className="block w-full px-4 py-2 text-white">
                                        Original images <span className="px-4 py-2 text-gray-400">({training._count.images})</span>
                                    </Link>
                                </li>
                                {imageGroups.map((group) => (
                                    <li key={group.id} className={'hover:hover:bg-primary-dark'}>
                                        <Link to={`/training/${training.id}/imagegroup/${group.id}`} className="block w-full px-4 py-2 text-white">
                                            {group.name} <span className="px-4 py-2 text-gray-400">({group._count.images})</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <Form action={`/training/${training.id}/createimagegroup`} method="post">
                            <Button variant="secondary" size="full" className="mb-4">
                                Create new image set
                            </Button>
                        </Form>
                    </div>
                </Panel>
            </div>
            <div className="flex-1 sm:w-4/5">
                <Outlet />
            </div>
            <HelpPanel />
        </div>
    );
}

function HelpPanel() {
    const { help, isOpen, toggleHelp } = useHelp();

    return (
        <div
            className={clsx(
                'absolute -right-12 top-0 z-10 h-full min-w-[400px] border-l border-gray-800 bg-gray-900 shadow-2xl shadow-black transition-transform duration-300 sm:w-1/5',
                isOpen ? 'translate-x right-0' : 'translate-x-full',
            )}>
            <Panel heading="Help" classes="h-full" closeable onClose={() => toggleHelp()}>
                <div className="space-y-4 text-sm leading-6">{help}</div>
            </Panel>
        </div>
    );
}
