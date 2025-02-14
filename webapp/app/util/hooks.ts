import { useEffect } from 'react';
import { useFormAction, useNavigation } from 'react-router';
import { toast as showToast } from 'sonner';

import { type Toast } from '~/services/toast.server';

/**
 * Returns true if the current navigation is submitting the current route's
 * form. Defaults to the current route's form action and method POST.
 *
 * Defaults state to 'non-idle'
 *
 * NOTE: the default formAction will include query params, but the
 * navigation.formAction will not, so don't use the default formAction if you
 * want to know if a form is submitting without specific query params.
 */
export function useIsPending({
    formAction,
    formMethod = 'POST',
    state = 'non-idle',
}: {
    formAction?: string;
    formMethod?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE';
    state?: 'submitting' | 'loading' | 'non-idle';
} = {}) {
    const contextualFormAction = useFormAction();
    const navigation = useNavigation();
    console.log(navigation, contextualFormAction);
    const isPendingState = state === 'non-idle' ? navigation.state !== 'idle' : navigation.state === state;
    return isPendingState && navigation.formAction === (formAction ?? contextualFormAction) && navigation.formMethod === formMethod;
}

export function useToast(toast?: Toast | null) {
    useEffect(() => {
        if (toast) {
            setTimeout(() => {
                showToast[toast.type](toast.title, {
                    id: toast.id,
                    description: toast.description,
                });
            }, 0);
        }
    }, [toast]);
}
