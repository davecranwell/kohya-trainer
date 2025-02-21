import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, Link, redirect, useActionData, useLoaderData } from 'react-router';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { getFormProps, getInputProps, SubmissionResult, useForm } from '@conform-to/react';
import { z } from 'zod';

import prisma from '#/prisma/db.server';

import { authenticator, isAuthenticated } from '~/services/auth.server';

import { ErrorList, Field, Fieldset } from '~/components/forms';
import { SocialButton } from '~/components/social-button';
import { StatusButton } from '~/components/status-button';
import { useIsPending } from '~/util/hooks';
import { Container } from '~/components/container';
import { Divider } from '~/components/divider';
import { createAccount, hashPassword } from '~/services/account.server';

const signupSchema = z
    .object({
        email: z
            .string({ required_error: 'Email is required' })
            .email({ message: 'Email is invalid' })
            .min(3, { message: 'Email is too short' })
            .max(100, { message: 'Email is too long' }),
        password: z
            .string({ required_error: 'Password is required' })
            .min(12, { message: 'Password is too short' })
            .max(100, { message: 'Password is too long' }),
        confirmPassword: z
            .string({ required_error: 'Confirm password is required' })
            .min(12, { message: 'Password is too short' })
            .max(100, { message: 'Password is too long' }),
    })
    .refine(
        ({ password, confirmPassword }) => {
            if (password !== confirmPassword) {
                return false;
            }

            return true;
        },
        {
            message: 'Passwords do not match',
        },
    );

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.clone().formData();
    const submission = parseWithZod(formData, { schema: signupSchema });

    if (submission.status !== 'success') {
        return submission.reply();
    }

    const inviteOnly = process.env.INVITE_ONLY === 'true';
    const inviteCode = formData.get('inviteCode') as string | null;

    if (inviteOnly) {
        if (!inviteCode) {
            return submission.reply({ formErrors: ['Invite code is required'] });
        }

        const invite = await prisma.invite.findUnique({
            where: { id: inviteCode },
        });

        if (!invite) {
            return submission.reply({ formErrors: ['Invite code is invalid'] });
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
            return submission.reply({ formErrors: ['Invite code has expired'] });
        }
    }

    // find any user with the email
    try {
        const user = await createAccount({
            email: submission.value.email,
            password: submission.value.password,
        });

        if (user && inviteCode) {
            // delete invite
            await prisma.invite.delete({
                where: { id: inviteCode },
            });

            return await authenticator.authenticate('email-pass', request);
        }
    } catch (error) {
        if (error instanceof Error) {
            return submission.reply({ formErrors: [error.message] });
        }

        return submission.reply({ formErrors: ['An error occurred while creating your account'] });
    }

    try {
        return await authenticator.authenticate('email-pass', request);
    } catch (error) {
        console.log({ error });
        if (error instanceof Response) return error;
        if (error instanceof Error) {
            return submission.reply({ formErrors: ['Invalid username or password'] });
        }
    }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    if (await isAuthenticated(request)) {
        return redirect('/training');
    }

    const url = new URL(request.url);
    const inviteCode = url.searchParams.get('inviteCode');
    const inviteOnly = process.env.INVITE_ONLY === 'true';

    if (inviteOnly && !inviteCode) {
        return redirect('/login');
    }

    if (inviteCode) {
        const invite = await prisma.invite.findUnique({
            where: { id: inviteCode },
        });

        if (!invite) {
            return redirect('/login');
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
            return redirect('/login');
        }
    }

    return { inviteCode };
}

export default function Login() {
    const { inviteCode } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const isSubmitting = useIsPending();
    const [form, fields] = useForm({
        lastResult: actionData as SubmissionResult<string[]> | null | undefined,
        constraint: getZodConstraint(signupSchema),
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
                                autoComplete: 'new-password',
                            }}
                            errors={fields.password.errors}
                        />
                        <Field
                            labelProps={{ children: 'Confirm Password' }}
                            inputProps={{
                                ...getInputProps(fields.confirmPassword, { type: 'password' }),
                                autoComplete: 'new-password',
                            }}
                            errors={fields.confirmPassword.errors}
                        />
                        <StatusButton type="submit" status={isSubmitting.isPending ? 'pending' : 'idle'} size="full">
                            Sign up
                        </StatusButton>
                        {inviteCode && <input type="hidden" name="inviteCode" value={inviteCode} />}
                    </Fieldset>
                </Form>

                <Divider title="Or with your favourite provider" />

                <SocialButton provider={'discord'} label="Sign up with Discord" />

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
        </div>
    );
}
