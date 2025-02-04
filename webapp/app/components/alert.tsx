import React from 'react';
import { CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const alertVariants = cva('flex gap-2 rounded p-4', {
    variants: {
        prominence: {
            default: '',
        },
        type: {
            default: '',
            bordered: 'border',
        },
        variant: {
            info: 'border-semantic-info',
            warning: 'border-semantic-warning ',
            error: 'border-semantic-error ',
            success: 'border-semantic-success',
        },
    },
    defaultVariants: {
        variant: 'info',
        type: 'default',
    },
});

export const Alert = ({
    children,
    variant,
    type,
}: {
    children: React.ReactNode;
    variant: VariantProps<typeof alertVariants>['variant'];
    type?: VariantProps<typeof alertVariants>['type'];
}) => {
    return (
        <div className={clsx(alertVariants({ variant, type }))}>
            <div>
                {variant === 'info' && <InfoCircledIcon className="h-5 w-5 text-semantic-info" />}
                {variant === 'warning' && <ExclamationTriangleIcon className="h-5 w-5 text-semantic-warning" />}
                {variant === 'error' && <ExclamationTriangleIcon className="h-5 w-5 text-semantic-error" />}
                {variant === 'success' && <CheckCircledIcon className="h-5 w-5 text-semantic-success" />}
            </div>
            <div>{children}</div>
        </div>
    );
};
