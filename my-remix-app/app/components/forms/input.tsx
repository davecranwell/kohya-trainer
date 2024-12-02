import * as React from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
    return (
        <div className="">
            <input
                type={type}
                className={clsx(
                    `aria-invalid:border-semantic-error w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-gray-200 placeholder-gray-500 transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50`,
                    className,
                )}
                ref={ref}
                {...props}
            />
        </div>
    );
});
Input.displayName = 'Input';

export { Input };
