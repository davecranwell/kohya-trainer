import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, json, useActionData, useLoaderData } from '@remix-run/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { z } from 'zod';
import { AuthorizationError } from 'remix-auth';

import { authenticator } from '~/services/auth.server';

import { Field } from '~/components/forms';
import { SocialButton } from '~/components/social-button';

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
});

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.clone().formData();
    const submission = parseWithZod(formData, { schema: loginSchema });

    if (submission.status !== 'success') {
        return submission.reply();
    }

    try {
        return await authenticator.authenticate('email-pass', request, {
            successRedirect: '/dashboard',
            throwOnError: true,
        });
    } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof AuthorizationError) {
            return submission.reply({ formErrors: ['Invalid username or password'] });
        }
    }
}

export async function loader({ request }: LoaderFunctionArgs) {
    await authenticator.isAuthenticated(request, {
        successRedirect: '/dashboard',
    });

    return null;
}

export default function Login() {
    const actionData = useActionData<typeof action>();

    const [form, fields] = useForm({
        lastResult: actionData,
        constraint: getZodConstraint(loginSchema),
        // shouldValidate: 'onBlur',
    });

    return (
        <div>
            <div id={form.errorId}>{form.errors && <p>{form.errors}</p>}</div>

            <Form method="post" {...getFormProps(form)}>
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
                        autoComplete: 'current-password',
                    }}
                    errors={fields.password.errors}
                />
                <button>Sign In</button>
            </Form>

            <SocialButton provider={'google'} label="Login with Google" />
        </div>
    );
}
