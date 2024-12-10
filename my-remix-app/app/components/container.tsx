import { clsx } from 'clsx';

export const Container = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    return <div className={clsx('w-full space-y-4 space-y-8 rounded-xl border border-gray-800 bg-gray-900 p-6', className)}>{children}</div>;
};
