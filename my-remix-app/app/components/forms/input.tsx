import * as React from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
    return (
        <div className="">
            <input
                type={type}
                className={clsx(
                    'focus:ring-primary block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset',
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
