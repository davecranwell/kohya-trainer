import { getFormProps, getInputProps, getTextareaProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { type Training } from '@prisma/client';
import { Form, useActionData, useLoaderData } from 'react-router';
import { ExternalLinkIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { z } from 'zod';

import { useIsPending } from '~/util/hooks';
import { type action } from './training-editor.server';

import { ErrorList, Field } from '~/components/forms';
import { Button } from '~/components/button';
import { StatusButton } from '~/components/status-button';
import { Container } from '~/components/container';
import { Alert } from '~/components/alert';
export const TrainingEditorSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    triggerWord: z.string().min(4).max(10),
    baseModel: z.string().url(),
});

type SerializeFrom<T> = ReturnType<typeof useLoaderData<T>>;

export function TrainingEditor({ training }: { training?: SerializeFrom<Pick<Training, 'id' | 'name' | 'triggerWord' | 'baseModel'>> }) {
    const actionData = useActionData<typeof action>();
    const isPending = useIsPending();

    const [form, fields] = useForm({
        id: `training-editor-${training?.id}`,
        constraint: getZodConstraint(TrainingEditorSchema),
        lastResult: actionData?.result,
        onValidate({ formData }) {
            return parseWithZod(formData, { schema: TrainingEditorSchema });
        },
        defaultValue: {
            ...training,
        },
        shouldRevalidate: 'onBlur',
    });

    const { key: nameKey, ...nameProps } = getInputProps(fields.name, { type: 'text' });
    const { key: triggerWordKey, ...triggerWordProps } = getInputProps(fields.triggerWord, { type: 'text' });
    const { key: baseModelKey, ...baseModelProps } = getInputProps(fields.baseModel, { type: 'text' });

    return (
        <Container>
            <Form method="POST" {...getFormProps(form)} encType="multipart/form-data">
                {training ? <input type="hidden" name="id" value={training.id} /> : null}
                <div className="space-y-8 border-b border-gray-900/10">
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-900/10 pb-12">
                        <Alert variant="info">
                            <p className="basis-1/2 text-sm leading-6">
                                The name given has no impact on the training process. It just allows you to identify this training later.
                            </p>
                        </Alert>
                        <Field
                            labelProps={{ children: 'Training name' }}
                            inputProps={{
                                autoFocus: true,
                                ...nameProps,
                            }}
                            errors={fields.name.errors}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-900/10 pb-12">
                        <div>
                            <Alert variant="info">
                                <p className="basis-1/2 text-sm leading-6">
                                    The word(s) to activate the Lora while generating an image.
                                    <br />
                                    <br />
                                    Loras teach a base model a brand new concept, or enhance an existing one. For new concepts use a trigger word that
                                    is <em className="text-semantic-info">unknown</em> to the base model. Most English dictionary words are already
                                    known. Random-letter, or username-like words work well (e.g 'ohxw', 'johndoe420') because no dictionary word could
                                    clash and dilute the concept you're teaching.
                                </p>
                            </Alert>
                            <Alert variant="warning">
                                <p className="text-sm leading-6">
                                    NB: Combining multiple loras all trained with the same trigger word will cause confusion in your image generation.
                                </p>
                            </Alert>
                        </div>
                        <Field
                            labelProps={{ children: 'Trigger word(s)' }}
                            inputProps={{
                                ...triggerWordProps,
                            }}
                            errors={fields.triggerWord.errors}
                            help="e.g 'ohxw'. 4-10 characters long"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pb-12">
                        <div>
                            <Alert variant="info">
                                <p className="text-sm leading-6">
                                    Loras are like music remixes, building upon an original idea. The base model will define key characteristics of
                                    the Lora's output, so select one that matches the style or content of the output you want.
                                </p>
                            </Alert>
                            <Alert variant="warning">
                                <p className="text-sm leading-6">
                                    NB: Your Lora will generate the best images{' '}
                                    <em className="text-semantic-warning">only when used with the base model you choose here</em>. Use of a different
                                    base model with this Lora may cause poor results.
                                </p>
                            </Alert>
                        </div>
                        {/* <MultiComboBoxCivitai
                            name="baseModel"
                            defaultValue={training?.baseModel}
                            onChange={(options) => {
                                fields.baseModel.change(options.join(','));
                            }}
                        /> */}
                        <Field
                            labelProps={{ children: 'Base model URL' }}
                            inputProps={{
                                ...baseModelProps,
                            }}
                            errors={fields.baseModel.errors}
                            help={
                                <a href="https://civitai.com/models" target="_blank" rel="noreferrer" className="text-accent1 hover:underline">
                                    Find one on Civitai.com <ExternalLinkIcon className="inline-block h-4 w-4" />
                                </a>
                            }
                        />
                    </div>
                </div>
                <ErrorList id={form.errorId} errors={form.errors} />

                <div className="mt-6 flex items-center justify-end gap-x-6">
                    <Button variant="ghost" {...form.reset.getButtonProps()}>
                        Reset
                    </Button>
                    <StatusButton form={form.id} type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
                        Continue
                    </StatusButton>
                </div>
            </Form>
        </Container>
    );
}
