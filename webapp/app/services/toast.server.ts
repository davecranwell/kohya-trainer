import { createId as cuid } from '@paralleldrive/cuid2';
import { createCookieSessionStorage, redirect } from 'react-router';
import { z } from 'zod';
import { combineHeaders } from '~/util/misc';

export const toastKey = 'toast';

const ToastSchema = z.object({
    description: z.string().optional(),
    id: z.string().default(() => cuid()),
    title: z.string().optional(),
    type: z.enum(['message', 'success', 'error']).default('message'),
});

export type Toast = z.infer<typeof ToastSchema>;
export type ToastInput = z.input<typeof ToastSchema>;

export const toastStorage = createCookieSessionStorage({
    cookie: {
        name: 'en_toast',
        sameSite: 'lax',
        path: '/',
        httpOnly: true,
        secrets: process.env.SESSION_SECRET?.split(','),
        secure: process.env.NODE_ENV === 'production',
    },
});

export async function redirectWithToast(url: string, toast: ToastInput, init?: ResponseInit) {
    return redirect(url, {
        ...init,
        headers: combineHeaders(init?.headers, await createToastHeaders(toast)),
    });
}

export async function createToastHeaders(toastInput: ToastInput) {
    const session = await toastStorage.getSession();
    const toast = ToastSchema.parse(toastInput);

    session.flash(toastKey, toast);

    const cookie = await toastStorage.commitSession(session);
    return new Headers({ 'set-cookie': cookie });
}

export async function getToast(request: Request) {
    const session = await toastStorage.getSession(request.headers.get('cookie'));
    const result = ToastSchema.safeParse(session.get(toastKey));
    const toast = result.success ? result.data : null;

    return {
        toast,
        headers: toast
            ? new Headers({
                  'set-cookie': await toastStorage.destroySession(session),
              })
            : null,
    };
}
