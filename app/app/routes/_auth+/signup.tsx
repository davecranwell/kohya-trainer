import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { type SEOHandle } from '@nasa-gcn/remix-seo';
import * as E from '@react-email/components';
import { json, redirect, type ActionFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Form, useActionData, useSearchParams } from '@remix-run/react';
import { HoneypotInputs } from 'remix-utils/honeypot/react';
import { z } from 'zod';
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx';
import { ErrorList, Field } from '#app/components/forms.tsx';
import { StatusButton } from '#app/components/ui/status-button.tsx';
import { ProviderConnectionForm, providerNames } from '#app/utils/connections.tsx';
import { prisma } from '#app/utils/db.server.ts';
import { sendEmail } from '#app/utils/email.server.ts';
import { checkHoneypot } from '#app/utils/honeypot.server.ts';
import { useIsPending } from '#app/utils/misc.tsx';
import { EmailSchema } from '#app/utils/user-validation.ts';
import { prepareVerification } from './verify.server.ts';

export const handle: SEOHandle = {
    getSitemapEntries: () => null,
};

const SignupSchema = z.object({
    email: EmailSchema,
});

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();

    checkHoneypot(formData);

    const submission = await parseWithZod(formData, {
        schema: SignupSchema.superRefine(async (data, ctx) => {
            const existingUser = await prisma.user.findUnique({
                where: { email: data.email },
                select: { id: true },
            });
            if (existingUser) {
                ctx.addIssue({
                    path: ['email'],
                    code: z.ZodIssueCode.custom,
                    message: 'A user already exists with this email',
                });
                return;
            }
        }),
        async: true,
    });
    if (submission.status !== 'success') {
        return json({ result: submission.reply() }, { status: submission.status === 'error' ? 400 : 200 });
    }
    const { email } = submission.value;
    const { verifyUrl, redirectTo, otp } = await prepareVerification({
        period: 10 * 60,
        request,
        type: 'onboarding',
        target: email,
    });

    const response = await sendEmail({
        to: email,
        subject: `Welcome to Epic Notes!`,
        react: <SignupEmail onboardingUrl={verifyUrl.toString()} otp={otp} />,
    });

    if (response.status === 'success') {
        return redirect(redirectTo.toString());
    } else {
        return json(
            {
                result: submission.reply({ formErrors: [response.error.message] }),
            },
            {
                status: 500,
            },
        );
    }
}

export function SignupEmail({ onboardingUrl, otp }: { onboardingUrl: string; otp: string }) {
    return (
        <E.Html lang="en" dir="ltr">
            <E.Container>
                <h1>
                    <E.Text>Welcome to Epic Notes!</E.Text>
                </h1>
                <p>
                    <E.Text>
                        Here's your verification code: <strong>{otp}</strong>
                    </E.Text>
                </p>
                <p>
                    <E.Text>Or click the link to get started:</E.Text>
                </p>
                <E.Link href={onboardingUrl}>{onboardingUrl}</E.Link>
            </E.Container>
        </E.Html>
    );
}

export const meta: MetaFunction = () => {
    return [{ title: 'Sign Up | Epic Notes' }];
};

export default function SignupRoute() {
    const actionData = useActionData<typeof action>();
    const isPending = useIsPending();
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirectTo');

    const [form, fields] = useForm({
        id: 'signup-form',
        constraint: getZodConstraint(SignupSchema),
        lastResult: actionData?.result,
        onValidate({ formData }) {
            const result = parseWithZod(formData, { schema: SignupSchema });
            return result;
        },
        shouldRevalidate: 'onBlur',
    });

    return (
        <div>
            <div className="flex flex-col gap-3 text-center">
                <h1 className="h1">Let's start your journey!</h1>
                <p>Please enter your email.</p>
            </div>
            <div className="mx-auto w-full max-w-md py-8">
                <Form method="POST" {...getFormProps(form)}>
                    <HoneypotInputs />
                    <Field
                        labelProps={{
                            htmlFor: fields.email.id,
                            children: 'Email',
                        }}
                        inputProps={{
                            ...getInputProps(fields.email, { type: 'email' }),
                            autoFocus: true,
                            autoComplete: 'email',
                        }}
                        errors={fields.email.errors}
                    />
                    <ErrorList errors={form.errors} id={form.errorId} />
                    <div className="flex items-center justify-between gap-6 pt-3">
                        <StatusButton className="w-full" status={isPending ? 'pending' : (form.status ?? 'idle')} type="submit" disabled={isPending}>
                            Submit
                        </StatusButton>
                    </div>
                </Form>
                <ul className="border-border mt-5 flex flex-col gap-5 border-b-2 border-t-2 py-3">
                    <p className="text-sm text-gray-500">Or sign up with your favourite providers:</p>
                    {providerNames.map((providerName) => (
                        <li key={providerName}>
                            <ProviderConnectionForm type="Signup" providerName={providerName} redirectTo={redirectTo} />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <GeneralErrorBoundary />;
}
