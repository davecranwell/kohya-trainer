import clsx from 'clsx';

export const Divider = ({ title, className }: { title?: string; className?: string }) => (
    <div className={clsx('relative my-10', className)}>
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-800"></div>
        </div>

        <div className="relative flex justify-center text-sm">
            <span className="bg-gray-900 px-6">{title}</span>
        </div>
    </div>
);
