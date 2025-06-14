import { clsx } from 'clsx';

export const ImagegroupList = ({ heading, children, className }: { heading: string; children: React.ReactNode; className?: string }) => {
    return (
        <div className={clsx('p-6', className)}>
            <h2>{heading}</h2>
            {children}
        </div>
    );
};
