import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const buttonVariants = cva(
    'inline-flex flex gap-2 items-center justify-center rounded-lg transition-all duration-300 truncate disabled:opacity-50 disabled:hover:cursor-not-allowed',
    {
        variants: {
            variant: {
                default: '',
                secondary: 'bg-accent1 hover:bg-accent1-dark text-gray-900',
                tertiary: 'bg-accent2 hover:bg-accent2-dark text-white',
                success: 'bg-semantic-success hover:bg-semantic-success-dark text-white',
                info: 'bg-semantic-info hover:bg-semantic-info-dark text-white',
                warning: 'bg-semantic-warning hover:bg-semantic-warning-dark text-white',
                error: 'border border-semantic-error hover:bg-semantic-error-dark text-white',
            },
            display: {
                default: 'border border-stroke text-white hover:bg-primary-dark ',
                ghost: 'bg-black/40 hover:bg-accent1-dark/60 text-white',
                textonly: '',
            },
            size: {
                default: 'h-10 px-4 py-2',
                wide: 'px-24 py-5',
                sm: 'h-8 px-3',
                lg: 'h-11 px-8',
                pill: 'px-2 py-2 leading-3',
                icon: 'h-8 w-8',
                full: 'w-full py-2',
                text: '',
            },
        },
        compoundVariants: [
            {
                variant: 'default',
                display: 'textonly',
                class: 'text-semantic-info',
            },
            {
                variant: 'default',
                display: 'ghost',
                class: 'border border-stroke bg-black/40 hover:bg-primary-dark',
            },
            {
                variant: 'default',
                display: 'default',
                class: 'bg-primary border-primary',
            },
            {
                variant: 'error',
                display: 'default',
                class: 'bg-semantic-error border-semantic-error',
            },
            {
                variant: 'error',
                display: 'ghost',
                class: 'border-semantic-error',
            },
        ],
        defaultVariants: {
            display: 'default',
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    icon?: React.ComponentType<{ className?: string }>;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, icon, children, display, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        const Icon = icon;

        if (asChild) {
            // When asChild is true, we need to ensure only one child is passed to Slot
            // The icon will be handled by the child component itself
            return (
                <Comp className={clsx(buttonVariants({ variant, size, className, display }))} ref={ref} {...props}>
                    {children}
                </Comp>
            );
        }

        return (
            <Comp className={clsx(buttonVariants({ variant, size, className, display }))} ref={ref} {...props}>
                {Icon && <Icon className="size-4 flex-none" />}
                {children}
            </Comp>
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
