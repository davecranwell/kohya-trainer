import { clsx } from 'clsx';
import { Cross1Icon } from '@radix-ui/react-icons';

import { Button } from './button';

export const Panel = ({
    heading,
    children,
    classes,
    scrollable = true,
    bodyClasses,
    closeable = false,
    onClose,
}: {
    heading: React.ReactNode | string;
    children: React.ReactNode;
    classes?: string;
    scrollable?: boolean;
    bodyClasses?: string;
    closeable?: boolean;
    onClose?: () => void;
}) => {
    return (
        <div className={clsx(`flex flex-col justify-stretch ${classes ? classes : ''}`)}>
            <div className="flex flex-none flex-row items-center justify-between border-b border-gray-800 p-4">
                <h2 className="e flex-none truncate text-lg">{heading}</h2>
                {closeable && (
                    <Button variant="ghost" size="icon" onClick={onClose} title="Close">
                        <Cross1Icon className="h-4 w-4 text-white" />
                    </Button>
                )}
            </div>
            <div className={clsx('flex-1 p-8 sm:max-h-screen', scrollable ? 'sm:overflow-y-auto' : 'overflow-hidden', bodyClasses)}>{children}</div>
        </div>
    );
};
