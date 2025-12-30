import { useEffect, useState } from 'react';
import { data, Link, Outlet, useFetcher, type LoaderFunctionArgs } from 'react-router';
import { Form, useLoaderData } from 'react-router';
import { clsx } from 'clsx';
import { InfoCircledIcon, Pencil1Icon, TrashIcon, CopyIcon } from '@radix-ui/react-icons';
import { Dialog, DialogBackdrop, DialogPanel, Input, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { z } from 'zod';

import prisma from '#/prisma/db.server';

import { requireUserWithPermission } from '~/services/permissions.server';

import { TrainingEditor } from '~/routes/training-editor';
import { type BaseModel, type Training } from '~/types/training';
import { baseModels } from '~/util/difussion-models';
import { useHelp } from '~/util/help.provider';

import { ErrorList, Field } from '~/components/forms';
import { Container } from '~/components/container';
import { Panel } from '~/components/panel';
import { Button } from '~/components/button';
import { getTrainingByUserWithImageCount } from '~/services/training.server';
import { useTrainingStatus } from '~/util/trainingstatus.provider';
import { StatusPill } from '~/components/status-pill';
import { useCallback } from 'react';
import { ImageGroup } from '@prisma/client';
import { getFormProps, getInputProps, useForm } from '@conform-to/react';

export { action } from '~/routes/training-editor.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
    const userId = await requireUserWithPermission(request, 'create:training:own');

    const training = await getTrainingByUserWithImageCount(params.id!, userId);

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
        orderBy: { createdAt: 'desc' },
    });

    const ourBaseModels = baseModels.filter((m) => process.env.MODELS?.split(',').includes(m.type));

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
    const { trainingStatuses } = useTrainingStatus();
    const [isOpen, setIsOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ImageGroup | null>(null);

    return (
        <div className="sm:flex sm:h-full sm:min-h-screen sm:flex-row sm:overflow-hidden">
            <div className="flex-0 max-h-screen border-b border-gray-800 sm:w-1/5 sm:min-w-[400px] sm:border-r">
                <Panel heading={training.name || 'New training'} classes="h-full">
                    <TrainingEditor key={training.id} training={training as Training & { baseModel: BaseModel }} baseModels={baseModels} />

                    <div className="mt-8 space-y-4 border-t border-gray-800 pt-8">
                        <h2 className="flex flex-row items-center justify-between text-xl">
                            <span>Image sets</span>
                            <Button
                                display="textonly"
                                size="text"
                                className="text-sm"
                                icon={InfoCircledIcon}
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
                                <li key={'originals'} className="flex w-full text-white hover:hover:bg-black/40">
                                    <Link to={`/training/${training.id}`} className="flex items-center gap-2 px-4 py-2">
                                        <span className="truncate">Original images</span>
                                        <span className="flex-1 text-gray-400">({training._count.images})</span>
                                    </Link>
                                </li>
                                {imageGroups.map((group) => (
                                    <li key={group.id} className="flex w-full max-w-full items-center text-white hover:hover:bg-black/40">
                                        <Link
                                            to={`/training/${training.id}/imagegroup/${group.id}`}
                                            className="flex flex-1 items-center gap-2 truncate px-4 py-2">
                                            <span className="truncate">{group.name}</span>
                                            <span className="flex-1 text-gray-400">({group._count.images})</span>
                                        </Link>
                                        <span className="justify-self-end">
                                            <span className="flex flex-row items-center gap-2">
                                                {trainingStatuses[training.id]?.runs.filter((run) => run.imageGroupId === group.id)?.length > 0 && (
                                                    <StatusPill
                                                        className="justify-self-end"
                                                        status={
                                                            trainingStatuses[training.id]?.runs.filter((run) => run.imageGroupId === group.id)?.[0]
                                                                ?.status
                                                        }
                                                    />
                                                )}
                                            </span>
                                            <span>
                                                <Button
                                                    display="icononly"
                                                    size="icon"
                                                    icon={Pencil1Icon}
                                                    title="Edit image set"
                                                    onClick={() => {
                                                        setEditingGroup(group);
                                                        setIsOpen(true);
                                                    }}
                                                />
                                            </span>
                                            <span>
                                                <Form action={`/api/imagegroup/${group.id}/duplicate`} method="POST" className="inline">
                                                    <Button display="icononly" size="icon" icon={CopyIcon} title="Copy image set" />
                                                </Form>
                                            </span>
                                            <span>
                                                <Form action={`/api/imagegroup/${group.id}/delete`} method="DELETE" className="inline">
                                                    <Button
                                                        display="icononly"
                                                        size="icon"
                                                        icon={TrashIcon}
                                                        title="Delete image set"
                                                        onClick={() => {
                                                            setIsOpen(true);
                                                        }}
                                                    />
                                                </Form>
                                            </span>
                                        </span>
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
            <ImageGroupEditorModal isOpen={isOpen} setIsOpen={setIsOpen} group={editingGroup} />
        </div>
    );
}

function HelpPanel() {
    const { help, isOpen, toggleHelp } = useHelp();

    return (
        <div
            className={clsx(
                'absolute -right-12 top-0 z-10 h-full min-w-[400px] border-l border-gray-800 bg-gray-900 shadow-2xl shadow-black transition-transform duration-300 ease-in-out sm:w-1/5',
                isOpen ? 'translate-x right-0' : 'translate-x-full',
            )}>
            <Panel heading="Help" classes="h-full" closeable onClose={() => toggleHelp()}>
                <div className="space-y-4 text-sm leading-6">{help}</div>
            </Panel>
        </div>
    );
}

const ImageGroupEditorModal = ({
    isOpen = false,
    setIsOpen,
    group,
}: {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    group: ImageGroup | null;
}) => {
    const fetcher = useFetcher();
    const schema = z.object({ name: z.string().min(1).max(100, 'Name must be less than 100 characters') });

    const [form, fields] = useForm({
        id: `image-group-editor-${group?.id}`,
        lastResult: fetcher.data?.result,
        defaultValue: { name: group?.name },
        shouldValidate: 'onBlur',
        shouldRevalidate: 'onInput',
        onValidate({ formData }) {
            return parseWithZod(formData, { schema });
        },
    });

    useEffect(() => {
        if (fetcher.data?.success) {
            setIsOpen(false);
        }
    }, [fetcher.data]);

    const { key: nameKey, ...nameProps } = getInputProps(fields.name, { type: 'text' });

    return (
        <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
            <DialogBackdrop onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/50" />
            <div className="fixed inset-0 flex w-screen items-center justify-center">
                <Container className="flex min-h-[15vh] max-w-md self-center overflow-y-auto bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 shadow-2xl shadow-cyan-500/10">
                    <div className="flex min-h-full w-full">
                        <DialogPanel className="w-full">
                            <div>
                                <fetcher.Form method="post" action={`/api/${group?.id}/edit`} {...getFormProps(form)} className="space-y-6">
                                    <Field
                                        key={fields.name.key}
                                        labelProps={{ children: 'Image set name' }}
                                        inputProps={{
                                            ...nameProps,
                                            placeholder: 'e.g "My image set"',
                                        }}
                                        errors={fields.name.errors}
                                    />
                                    <Button type="submit" size="full" disabled={fields.name?.errors?.length ? true : false}>
                                        Save image set
                                    </Button>
                                </fetcher.Form>
                            </div>
                        </DialogPanel>
                    </div>
                </Container>
            </div>
        </Dialog>
    );
};
