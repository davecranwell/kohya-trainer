import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '#app/utils/misc.tsx';

const buttonVariants = cva('rounded-full', {
    variants: {
        variant: {
            default:
                'inline-flex items-center align-center rounded-md bg-primary px-3 py-2 font-semibold text-white shadow-sm hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ',
            destructive:
                'rounded-md bg-red-600 px-3 py-2 font-semibold text-white shadow-sm hover:bg-semantic-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-semantic-error-dark ',
            outline: 'rounded-md border border-input',
            secondary:
                'rounded-md bg-secondary px-3 py-2 font-semibold shadow-sm hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            link: 'underline-offset-4 hover:underline',
        },
        size: {
            default: 'h-10 px-4 py-2',
            wide: 'px-24 py-5',
            sm: 'h-9 rounded-md px-3',
            lg: 'h-11 rounded-md px-8',
            pill: 'px-12 py-3 leading-3',
            icon: 'h-10 w-10',
        },
    },
    defaultVariants: {
        variant: 'default',
        size: 'default',
    },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
