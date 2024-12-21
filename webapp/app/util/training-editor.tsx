import { getFormProps, getInputProps, getTextareaProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { type Training } from '@prisma/client';
import { type SerializeFrom } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { z } from 'zod';

import { useIsPending } from '~/util/hooks';
import { type action } from './training-editor.server';

import { ErrorList, Field } from '~/components/forms';
import { Button } from '~/components/button';
import { StatusButton } from '~/components/status-button';
import { Container } from '~/components/container';

export const TrainingEditorSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    triggerWord: z.string().min(4).max(10),
    baseModel: z.string().url(),
});

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
                <div className="space-y-8 border-b border-gray-900/10 pb-12">
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-900/10 pb-12">
                        <Field
                            labelProps={{ children: 'Name' }}
                            inputProps={{
                                autoFocus: true,
                                ...nameProps,
                            }}
                            errors={fields.name.errors}
                            help="Give your Lora a name to identify it later."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-900/10 pb-12">
                        <Field
                            labelProps={{ children: 'Trigger word(s)' }}
                            inputProps={{
                                ...triggerWordProps,
                            }}
                            errors={fields.triggerWord.errors}
                            help="e.g 'ohxw'. 4-10 characters long"
                        />
                        <p className="mt-1 basis-1/2 text-sm leading-6">
                            <InfoCircledIcon className="inline" />
                            The word(s) to activate the Lora while generating an image.
                            <br />
                            <br />
                            When training a person, use a trigger word that is unique to them but unknown to the base model, e.g 'ohxw man' for a man,
                            or 'ohxw cat' for a pet cat. If your trigger word is known in the base model, your training will have to fight the base
                            model's existing understanding of that word. Non-words like "ohxw" are therefore useful as your base model is unlikely to
                            already understand them.
                            <br />
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pb-12">
                        <Field
                            labelProps={{ children: 'Base model' }}
                            inputProps={{
                                ...baseModelProps,
                            }}
                            errors={fields.baseModel.errors}
                            help=""
                        />
                        <p className="text-sm leading-6">
                            <InfoCircledIcon className="inline" />
                            Like a remix of your favourite song, your Lora will always slightly resemble your base model. Your choice of base model
                            greatly affects all the results of using your Lora so choose a base model that is similar to the output you want.
                        </p>
                    </div>
                </div>
                <ErrorList id={form.errorId} errors={form.errors} />

                <div className="mt-6 flex items-center justify-end gap-x-6">
                    <Button variant="ghost" {...form.reset.getButtonProps()}>
                        Reset
                    </Button>
                    <StatusButton form={form.id} type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
                        Submit
                    </StatusButton>
                </div>
            </Form>
        </Container>
    );
}
