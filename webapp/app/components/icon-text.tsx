import React from 'react';
import clsx from 'clsx';

export const IconText = ({
    icon,
    text,
    className,
}: {
    icon: React.ComponentType<{ className?: string }>;
    text: React.ReactNode;
    className?: string;
}) => {
    const Icon = icon;

    return (
        <div className={clsx('flex items-start gap-2', className)}>
            <Icon className="mt-0.5 flex-none" />
            {text}
        </div>
    );
};
