import * as React from 'react';

import { cn } from '#app/utils/misc.tsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
    return <input type={type} className={cn('input input-bordered w-full, max-w-xs', className)} ref={ref} {...props} />;
});
Input.displayName = 'Input';

export { Input };