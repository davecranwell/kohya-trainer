import * as React from 'react';
import { UpdateIcon, CheckIcon, Cross1Icon } from '@radix-ui/react-icons';

import { Button, type ButtonProps } from './button';

export const StatusButton = React.forwardRef<
    HTMLButtonElement,
    ButtonProps & {
        status: 'pending' | 'success' | 'error' | 'idle' | 'submitting' | 'loading';
    }
>(({ status, className, children, icon, ...props }, ref) => {
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

    const iconClassName = normalizedStatus === 'pending' ? 'animate-spin' : '';

    // Only get icon if the status has a corresponding icon
    const decidedIcon = normalizedStatus in icons ? icons[normalizedStatus as keyof typeof icons] : icon;

    return (
        <Button ref={ref} icon={decidedIcon} iconClassName={iconClassName} className={className} {...props}>
            {children}
        </Button>
    );
});
StatusButton.displayName = 'Button';
