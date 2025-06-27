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
    headingRight,
}: {
    heading: React.ReactNode | string;
    children: React.ReactNode;
    classes?: string;
    scrollable?: boolean;
    bodyClasses?: string;
    closeable?: boolean;
    onClose?: () => void;
    headingRight?: React.ReactNode;
}) => {
    return (
        <div className={clsx(`flex flex-col justify-stretch ${classes ? classes : ''}`)}>
            <div className="flex min-h-16 flex-none flex-row items-center justify-between border-b border-gray-800 px-4">
                <h2 className="e flex-none truncate text-lg">{heading}</h2>
                {closeable && <Button display="ghost" size="icon" icon={Cross1Icon} onClick={onClose} title="Close" />}
                {headingRight}
            </div>
            <div className={clsx('flex-1 p-8 sm:max-h-screen', scrollable ? 'sm:overflow-y-auto' : 'overflow-hidden', bodyClasses)}>{children}</div>
        </div>
    );
};
