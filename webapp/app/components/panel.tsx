import { clsx } from 'clsx';

export const Panel = ({
    heading,
    children,
    className,
    scrollable = true,
    bodyClassName,
}: {
    heading: string;
    children: React.ReactNode;
    className?: string;
    scrollable?: boolean;
    bodyClassName?: string;
}) => {
    return (
        <div className={clsx('flex flex-col justify-stretch', className)}>
            <h2 className="flex-none truncate border-b border-gray-800 p-4 text-xl text-white">{heading}</h2>
            <div className={clsx('flex-1 p-8 sm:max-h-screen', scrollable ? 'sm:overflow-y-auto' : 'overflow-hidden', bodyClassName)}>{children}</div>
        </div>
    );
};
