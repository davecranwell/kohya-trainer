import * as React from 'react';
import { useSpinDelay } from 'spin-delay';
import { clsx } from 'clsx';
import { UpdateIcon, CheckIcon, Cross1Icon } from '@radix-ui/react-icons';

import { Button, type ButtonProps } from './button';

export const StatusButton = React.forwardRef<
    HTMLButtonElement,
    ButtonProps & {
        status: 'pending' | 'success' | 'error' | 'idle' | 'submitting' | 'loading';
    }
>(({ status, className, children, ...props }, ref) => {
    switch (status) {
        case 'submitting':
        case 'loading':
            status = 'pending';
    }

    const showSpinner = useSpinDelay(status === 'pending', { delay: 50, minDuration: 1000 });
    const icon = {
        pending: showSpinner ? (
            <div role="status" className="inline-flex h-6 w-6 items-center justify-center">
                <UpdateIcon className="animate-spin" />
            </div>
        ) : null,
        success: (
            <div role="status" className="inline-flex h-6 w-6 items-center justify-center">
                <CheckIcon />
            </div>
        ),
        error: (
            <div role="status" className="bg-destructive inline-flex h-6 w-6 items-center justify-center rounded-full">
                <Cross1Icon />
            </div>
        ),
        idle: null,
    }[status];

    return (
        <Button ref={ref} className={clsx('flex justify-center gap-2', className)} {...props}>
            {icon}
            <div>{children}</div>
        </Button>
    );
});
StatusButton.displayName = 'Button';
