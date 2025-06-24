import React from 'react';
import clsx from 'clsx';

export const IconText = ({
    icon,
    text,
    className,
    iconalign = 'top',
}: {
    icon: React.ComponentType<{ className?: string }>;
    text: React.ReactNode;
    className?: string;
    iconalign?: 'top' | 'center';
}) => {
    const Icon = icon;

    return (
        <div className={clsx('flex items-start gap-2', { 'items-center': iconalign === 'center' }, className)}>
            <Icon className={clsx('h-4 w-4 flex-none', iconalign === 'top' && 'mt-0.5')} />
            {text}
        </div>
    );
};
