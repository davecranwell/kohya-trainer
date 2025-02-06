import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, useActionData } from 'react-router';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { getFormProps, getInputProps, SubmissionResult, useForm } from '@conform-to/react';
import { z } from 'zod';

import { authenticator, requireAuthenticated } from '~/services/auth.server';

import { ErrorList, Field, Fieldset } from '~/components/forms';
import { SocialButton } from '~/components/social-button';
import { StatusButton } from '~/components/status-button';
import { Button } from '~/components/button';
import { useIsPending } from '~/util/hooks';
import { Container } from '~/components/container';
import { Divider } from '~/components/divider';

const loginSchema = z.object({
    email: z
        .string({ required_error: 'Email is required' })
        .email({ message: 'Email is invalid' })
        .min(3, { message: 'Email is too short' })
        .max(100, { message: 'Email is too long' }),
    password: z
        .string({ required_error: 'Password is required' })
        .min(10, { message: 'Password is too short' })
        .max(100, { message: 'Password is too long' }),
    confirmPassword: z.string({ required_error: 'Confirm password is required' }),
});

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.clone().formData();
    const submission = parseWithZod(formData, { schema: loginSchema });

    if (submission.status !== 'success') {
        return submission.reply();
    }

    try {
        return await authenticator.authenticate('email-pass', request);
    } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof Error) {
            return submission.reply({ formErrors: ['Invalid username or password'] });
        }
    }
}

export async function loader({ request }: LoaderFunctionArgs) {
    await requireAuthenticated(request, '/dashboard');

    return null;
}

export default function Login() {
    const actionData = useActionData<typeof action>();
    const isSubmitting = useIsPending();
    const [form, fields] = useForm({
        lastResult: actionData as SubmissionResult<string[]> | null | undefined,
        constraint: getZodConstraint(loginSchema),
    });

    return (
        <Container>
            <ErrorList id={form.errorId} errors={form.errors} />
            <Form method="post" {...getFormProps(form)}>
                <Fieldset>
                    <Field
                        labelProps={{ children: 'Email' }}
                        inputProps={{
                            ...getInputProps(fields.email, { type: 'email' }),
                            autoFocus: true,
                            autoComplete: 'email',
                        }}
                        errors={fields.email.errors}
                    />
                    <Field
                        labelProps={{ children: 'Password' }}
                        inputProps={{
                            ...getInputProps(fields.password, { type: 'password' }),
                            autoFocus: true,
                            autoComplete: 'new-password',
                        }}
                        errors={fields.password.errors}
                    />
                    <Field
                        labelProps={{ children: 'Confirm Password' }}
                        inputProps={{
                            ...getInputProps(fields.confirmPassword, { type: 'password' }),
                            autoFocus: true,
                            autoComplete: 'new-password',
                        }}
                        errors={fields.confirmPassword.errors}
                    />
                    <StatusButton type="submit" status={isSubmitting ? 'pending' : 'idle'} size="full">
                        Sign up
                    </StatusButton>
                </Fieldset>
            </Form>

            <Divider title="Or with your favourite provider" />

            <SocialButton provider={'google'} label="Sign up with Google" />

            <Divider />

            <div className="flex justify-center text-sm">
                <p>
                    Already got an account?&nbsp;
                    <Link to="/login" className="text-accent1">
                        Login in now
                    </Link>
                </p>
            </div>
        </Container>
    );
}
