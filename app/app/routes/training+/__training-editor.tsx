import { getFormProps, getInputProps, getTextareaProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { type Training } from '@prisma/client';
import { type SerializeFrom } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';
import { z } from 'zod';
import { ErrorList, Field } from '#app/components/forms.tsx';
import { Button } from '#app/components/ui/button.tsx';
import { StatusButton } from '#app/components/ui/status-button.tsx';
import { useIsPending } from '#app/utils/misc.tsx';
import { type action } from './__training-editor.server';

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
        <div>
            <Form method="POST" {...getFormProps(form)} encType="multipart/form-data">
                {training ? <input type="hidden" name="id" value={training.id} /> : null}
                <div className="w-100 space-y-8 border-b border-gray-900/10 pb-12">
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-900/10 pb-12">
                        <Field
                            labelProps={{ children: 'Title' }}
                            inputProps={{
                                autoFocus: true,
                                ...nameProps,
                            }}
                            errors={fields.name.errors}
                            help="A title to identify your training in the list of trainings."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-900/10 pb-12">
                        <Field
                            labelProps={{ children: 'Trigger Word' }}
                            inputProps={{
                                ...triggerWordProps,
                            }}
                            errors={fields.triggerWord.errors}
                            help="e.g 'ohxw'. 4-10 characters long"
                        />
                        <p className="mt-1 basis-1/2 text-sm leading-6 text-gray-600">
                            The word(s) that will trigger the Lora to be activated while generating an image
                            <br />
                            <br />
                            When training a person, you should use a trigger word that is specific to that person, e.g 'ohxw man' for a man, or 'ohxw
                            cat' for a pet cat. If your trigger word is too common in the base model, your training will have to overcome the meaning
                            the base model has given to that word. This is why non-words can be useful in training brand new concepts, or those where you'd prefer
                            less room for interpretation.
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
                        <p className="text-sm leading-6 text-gray-600">
                            Your lora will always take some of its characteristics from the base model, so your choice of base model greatly affects
                            the results of the Lora you will create. The ideas you train into your lora through your training images will have to
                            compete with whatever styles, concepts and content are common in your base model.
                        </p>
                    </div>
                </div>
                <ErrorList id={form.errorId} errors={form.errors} />

                <div className="mt-6 flex items-center justify-end gap-x-6">
                    <Button variant="secondary" {...form.reset.getButtonProps()}>
                        Reset
                    </Button>
                    <StatusButton form={form.id} type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
                        Submit
                    </StatusButton>
                </div>
            </Form>
        </div>
    );
}
