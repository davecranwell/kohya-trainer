import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const buttonVariants = cva('inline-flex items-center justify-center rounded-lg transition-all duration-300', {
    variants: {
        variant: {
            default: 'bg-primary hover:bg-primary-dark text-white',
            secondary: 'bg-accent1 hover:bg-accent1-dark text-white',
            tertiary: 'bg-accent2 hover:bg-accent2-dark text-white',
            ghost: 'border border-stroke bg-black/40 text-gray-300 backdrop-blur-sm hover:bg-black/60',
            success: 'bg-semantic-success hover:bg-semantic-success-dark text-white',
            info: 'bg-semantic-info hover:bg-semantic-info-dark text-white',
            warning: 'bg-semantic-warning hover:bg-semantic-warning-dark text-white',
            error: 'bg-semantic-error hover:bg-semantic-error-dark text-white',
        },
        size: {
            default: 'h-10 px-4 py-2',
            wide: 'px-24 py-5',
            sm: 'h-9 px-3',
            lg: 'h-11 px-8',
            pill: 'px-2 py-2 leading-3',
            icon: 'h-8 w-8',
            full: 'w-full py-2',
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
    return <Comp className={clsx(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
