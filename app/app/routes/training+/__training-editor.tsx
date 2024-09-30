import { FormProvider, getFormProps, getInputProps, getTextareaProps, useForm } from '@conform-to/react';
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
        id: 'note-editor',
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

    return (
        <div className="absolute inset-0">
            <FormProvider context={form.context}>
                <Form method="POST" {...getFormProps(form)} encType="multipart/form-data">
                    {training ? <input type="hidden" name="id" value={training.id} /> : null}
                    <div>
                        <Field
                            labelProps={{ children: 'Title' }}
                            inputProps={{
                                autoFocus: true,
                                ...getInputProps(fields.name, { type: 'text' }),
                            }}
                            errors={fields.name.errors}
                        />
                        <Field
                            labelProps={{ children: 'Trigger Word' }}
                            inputProps={{
                                ...getTextareaProps(fields.triggerWord),
                            }}
                            errors={fields.triggerWord.errors}
                        />
                        <Field
                            labelProps={{ children: 'Base model' }}
                            inputProps={{
                                ...getTextareaProps(fields.baseModel),
                            }}
                            errors={fields.baseModel.errors}
                        />
                    </div>
                    <ErrorList id={form.errorId} errors={form.errors} />
                </Form>
                <div>
                    <Button variant="destructive" {...form.reset.getButtonProps()}>
                        Reset
                    </Button>
                    <StatusButton form={form.id} type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
                        Submit
                    </StatusButton>
                </div>
            </FormProvider>
        </div>
    );
}
