import { clsx } from 'clsx';
import { Button } from './button';
import { Cross1Icon } from '@radix-ui/react-icons';

export const Panel = ({
    heading,
    children,
    className,
    scrollable = true,
    bodyClassName,
    closeable = false,
    onClose,
}: {
    heading: string;
    children: React.ReactNode;
    className?: string;
    scrollable?: boolean;
    bodyClassName?: string;
    closeable?: boolean;
    onClose?: () => void;
}) => {
    return (
        <div className={clsx('flex flex-col justify-stretch', className)}>
            <div className="flex flex-row items-center justify-between border-b border-gray-800 p-4">
                <h2 className="flex-none truncate text-xl text-white">{heading}</h2>
                {closeable && (
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <Cross1Icon className="h-4 w-4 text-white" />
                    </Button>
                )}
            </div>
            <div className={clsx('flex-1 p-8 sm:max-h-screen', scrollable ? 'sm:overflow-y-auto' : 'overflow-hidden', bodyClassName)}>{children}</div>
        </div>
    );
};
