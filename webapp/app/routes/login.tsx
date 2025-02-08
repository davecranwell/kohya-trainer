import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, redirect, useActionData, useLoaderData } from 'react-router';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { getFormProps, getInputProps, useForm } from '@conform-to/react';

import { z } from 'zod';

import { authenticator, isAuthenticated, requireAuthenticated } from '~/services/auth.server';
import { useIsPending } from '~/util/hooks';
import { sessionStorage, getSession, destroySession } from '~/services/session.server';

import { ErrorList, Field, Fieldset } from '~/components/forms';
import { SocialButton } from '~/components/social-button';
import { StatusButton } from '~/components/status-button';
import { Button } from '~/components/button';
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
        .min(8, { message: 'Password is too short' })
        .max(100, { message: 'Password is too long' }),
});

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.clone().formData();
    const submission = parseWithZod(formData, { schema: loginSchema });

    if (submission.status !== 'success') {
        return submission.reply();
    }

    try {
        const user = await authenticator.authenticate('email-pass', request);

        const session = await sessionStorage.getSession(request.headers.get('cookie'));
        session.set('user', user);

        throw redirect('/training', {
            headers: { 'Set-Cookie': await sessionStorage.commitSession(session) },
        });
    } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof Error) {
            return submission.reply({ formErrors: ['No account found with this email or password'] });
        }
    }
}

export async function loader({ request }: LoaderFunctionArgs) {
    if (await isAuthenticated(request)) {
        return redirect('/training');
    }

    return null;
}

export default function Login() {
    const actionData = useActionData<typeof action>();
    const isSubmitting = useIsPending();
    const [form, fields] = useForm({
        lastResult: actionData,
        constraint: getZodConstraint(loginSchema),
    });

    return (
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
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
                                autoComplete: 'current-password',
                            }}
                            errors={fields.password.errors}
                        />
                        <StatusButton type="submit" status={isSubmitting ? 'pending' : 'idle'} size="full">
                            Sign In
                        </StatusButton>
                    </Fieldset>
                </Form>

                <Divider title="Or with your favourite provider" />

                <SocialButton provider={'discord'} label="Sign in with Discord" />

                <Divider />

                <div className="flex justify-center text-sm">
                    <Button asChild variant="secondary" size="lg">
                        <Link to="/sign-up">Create an account</Link>
                    </Button>
                </div>
            </Container>
        </div>
    );
}
