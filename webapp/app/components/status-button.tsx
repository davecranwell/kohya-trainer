import * as React from 'react';
import { clsx } from 'clsx';
import { UpdateIcon, CheckIcon, Cross1Icon } from '@radix-ui/react-icons';

import { Button, type ButtonProps } from './button';

export const StatusButton = React.forwardRef<
    HTMLButtonElement,
    ButtonProps & {
        status: 'pending' | 'success' | 'error' | 'idle' | 'submitting' | 'loading';
    }
>(({ status, className, children, ...props }, ref) => {
    // Normalize status to handle submitting/loading as pending
    let normalizedStatus = status;
    switch (status) {
        case 'submitting':
        case 'loading':
            normalizedStatus = 'pending';
            break;
    }

    const icons = {
        pending: UpdateIcon,
        success: CheckIcon,
        error: Cross1Icon,
    };

    // Only get icon if the status has a corresponding icon
    const icon = normalizedStatus in icons ? icons[normalizedStatus as keyof typeof icons] : undefined;

    return (
        <Button ref={ref} icon={icon} className={className} {...props}>
            {children}
        </Button>
    );
});
StatusButton.displayName = 'Button';
