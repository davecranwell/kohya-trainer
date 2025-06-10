import { useEffect, useReducer, useState } from 'react';
import { getFormProps, getInputProps, getCollectionProps, getTextareaProps, useForm, useInputControl } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { Form, useActionData, useLoaderData } from 'react-router';
import { CheckIcon, ExternalLinkIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Field as HeadlessField, Label as HeadlessLabel, Legend, Radio, RadioGroup } from '@headlessui/react';
import { z } from 'zod';

import { useIsPending } from '~/util/hooks';
import { type BaseModel, type Training } from '~/types/training';

import { ErrorList, Field, Fieldset } from '~/components/forms';
import { Label } from '~/components/forms/label';
import { Button } from '~/components/button';
import { StatusButton } from '~/components/status-button';
import { Container } from '~/components/container';
import { Alert } from '~/components/alert';
import { CivitaiBrowser } from '~/components/civitai-browser';
import { Tooltip, TooltipTrigger, TooltipContent } from '~/components/tooltip';

import { type action } from './training-editor.server';
import { useHelp } from './help.provider';

import civitai from '../assets/civitai.png';

export const TrainingEditorSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    triggerWord: z.string().min(4).max(10),
    baseModel: z.object({
        id: z.string(),
        name: z.string(),
        url: z.string().url(),
        filename: z.string(),
        type: z.string(),
    }),
});

type BaseModelState = {
    options: BaseModel[];
    selected: BaseModel | null;
};

type BaseModelAction = { type: 'ADD_AND_SELECT'; payload: BaseModel } | { type: 'SELECT'; payload: BaseModel | null };

function baseModelReducer(state: BaseModelState, action: BaseModelAction): BaseModelState {
    switch (action.type) {
        case 'ADD_AND_SELECT':
            return {
                options: [...state.options, action.payload],
                selected: action.payload,
            };
        case 'SELECT':
            return {
                ...state,
                selected: action.payload,
            };
        default:
            return state;
    }
}

export function TrainingEditor({ training, baseModels }: { training?: Training; baseModels: BaseModel[] }) {
    const { setHelp, toggleHelp } = useHelp();
    const actionData = useActionData<typeof action>();
    const isPending = useIsPending();
    const [isCivitaiBrowserOpen, setIsCivitaiBrowserOpen] = useState(false);
    const [baseModelState, dispatch] = useReducer(baseModelReducer, {
        options: baseModels,
        selected: training?.baseModel || null,
    });

    const [form, fields] = useForm({
        id: `training-editor-${training?.id}`,
        constraint: getZodConstraint(TrainingEditorSchema),
        lastResult: actionData?.result,
        defaultValue: training,
        shouldRevalidate: 'onBlur',
    });

    const handleChosenNewBaseModel = (model: BaseModel) => {
        dispatch({ type: 'ADD_AND_SELECT', payload: model });
    };

    const { key: nameKey, ...nameProps } = getInputProps(fields.name, { type: 'text' });
    const { key: triggerWordKey, ...triggerWordProps } = getInputProps(fields.triggerWord, { type: 'text' });
    const baseModelFields = fields.baseModel.getFieldset();
    return (
        <div>
            <Form method="POST" {...getFormProps(form)} encType="multipart/form-data">
                {training ? <input type="hidden" name="id" value={training.id} /> : null}
                <div className="space-y-6 border-b border-gray-800">
                    <div>
                        <Field
                            labelProps={{ children: 'Training name' }}
                            inputProps={{
                                autoFocus: true,
                                ...nameProps,
                                placeholder: 'e.g "My first Lora"',
                            }}
                            help={
                                <span className="flex items-center gap-2 text-sm leading-6">
                                    <InfoCircledIcon className="size-4 flex-none" /> An easy way to identify this training later.
                                </span>
                            }
                            errors={fields.name.errors}
                        />
                    </div>
                    <div>
                        <Field
                            labelProps={{ children: 'Trigger word(s)' }}
                            inputProps={{
                                ...triggerWordProps,
                                placeholder: 'e.g "ohxw"',
                                onMouseEnter: () =>
                                    setHelp(
                                        <p className="mb-2 text-sm leading-6">
                                            Loras teach a base model a brand new concept, or enhance an existing one. For new concepts use a trigger
                                            word that is <em className="text-semantic-warning">unknown</em> to the base model. Dictionary words are
                                            already known. Random, or username-style words work well (e.g 'ohxw', 'johndoe420') because no dictionary
                                            word could confuse their meaning. Case does not matter.
                                            <br />
                                            <br />
                                            <Alert variant="warning">
                                                <p className="text-sm leading-6">
                                                    Combining multiple loras which share the same trigger words could interfere in your image
                                                    generation. Try to use different trigger words for each Lora.
                                                </p>
                                            </Alert>
                                        </p>,
                                    ),
                                onMouseLeave: () => toggleHelp(),
                            }}
                            errors={fields.triggerWord.errors}
                            help={
                                <span className="flex items-center gap-2 text-sm leading-6">
                                    <InfoCircledIcon className="size-4 flex-none" /> The word(s) to activate the Lora while generating an image. 4-10
                                    characters long
                                </span>
                            }
                        />
                    </div>
                    <div>
                        <div>
                            <h3 className="mb-2 font-medium text-gray-300">Base model</h3>
                            <RadioGroup
                                className="flex flex-col divide-y divide-gray-800 rounded-lg border border-gray-800 bg-black/40"
                                value={baseModelState.selected}
                                by="id"
                                onChange={(value) => {
                                    dispatch({ type: 'SELECT', payload: value as BaseModel });
                                }}
                                onMouseEnter={() =>
                                    setHelp(
                                        <>
                                            <p className="text-sm leading-6">
                                                Loras are like game mods - they need an existing game to build on. The base model provides that
                                                foundation and largely defines the Lora's output, so select a base model that matches the style or
                                                content of the output you want.
                                            </p>

                                            <Alert variant="warning">
                                                <p className="text-sm leading-6">
                                                    NB: Like game mods, you can't put Loras into a game for which they weren't designed. Your Lora
                                                    will generate the best images{' '}
                                                    <em className="text-semantic-warning">only when used with the base model you choose here</em>.
                                                    Using a different base model with this Lora may cause poor results.
                                                </p>
                                            </Alert>
                                        </>,
                                    )
                                }
                                onMouseLeave={() => toggleHelp()}>
                                {baseModelState.options.map((model) => (
                                    <HeadlessField
                                        key={model?.id}
                                        className="group flex w-full flex-row items-center gap-2 transition-all hover:bg-primary-dark/60">
                                        <HeadlessLabel className="flex flex-1 gap-4 px-4 py-3 text-sm">
                                            <Radio
                                                value={model}
                                                className="block size-5 items-center justify-center rounded-full border border-gray-800 bg-black/40 ring-1 ring-gray-800 data-[checked]:bg-accent1"
                                            />
                                            <span>{model?.name}</span>
                                        </HeadlessLabel>
                                    </HeadlessField>
                                ))}
                                <div className="group flex w-full flex-row items-center gap-2">
                                    <div className="flex flex-1 gap-4 px-4 py-3 text-sm">
                                        <Button
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setIsCivitaiBrowserOpen(true);
                                            }}>
                                            Choose from Civitai <img src={civitai} alt="" className="ml-2 size-5" />
                                        </Button>
                                    </div>
                                </div>
                            </RadioGroup>

                            {baseModelFields.url.errors && <ErrorList id={baseModelFields.url.errorId} errors={baseModelFields.url.errors} />}

                            <CivitaiBrowser
                                onSelect={(model) => {
                                    const newModel = {
                                        id: model.id.toString(),
                                        name: `${model.originalModelName} - ${model.name}`,
                                        url: model.files[0].downloadUrl,
                                        filename: model.files[0].name,
                                        type: model.baseModel,
                                    };

                                    handleChosenNewBaseModel(newModel);
                                }}
                                supportedModels={baseModels.map((model) => model.type)}
                                isOpen={isCivitaiBrowserOpen}
                                setIsOpen={setIsCivitaiBrowserOpen}
                            />
                        </div>
                    </div>
                </div>
                <ErrorList id={form.errorId} errors={form.errors} />

                <input type="hidden" name="baseModel.id" value={baseModelState.selected?.id || training?.baseModel?.id} />
                <input type="hidden" name="baseModel.name" value={baseModelState.selected?.name || training?.baseModel?.name || ''} />
                <input type="hidden" name="baseModel.url" value={baseModelState.selected?.url || training?.baseModel?.url || ''} />
                <input type="hidden" name="baseModel.filename" value={baseModelState.selected?.filename || training?.baseModel?.filename || ''} />
                <input type="hidden" name="baseModel.type" value={baseModelState.selected?.type || training?.baseModel?.type || ''} />

                <div className="mt-6 flex items-center justify-end gap-x-6">
                    <StatusButton form={form.id} type="submit" disabled={isPending.isPending} status={isPending.isPending ? 'pending' : 'idle'}>
                        Continue
                    </StatusButton>
                </div>
            </Form>
        </div>
    );
}
