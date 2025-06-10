import { clsx } from 'clsx';

export const Panel = ({ heading, children, className }: { heading: string; children: React.ReactNode; className?: string }) => {
    return (
        <div className={clsx('', className)}>
            <h2 className="truncate border-b border-gray-800 p-4 text-xl">{heading}</h2>
            <div className="p-6">{children}</div>
        </div>
    );
};
