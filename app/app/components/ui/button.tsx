import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '#app/utils/misc.tsx';

const buttonVariants = cva('btn rounded-full', {
    variants: {
        variant: {
            default: 'btn-primary',
            destructive: 'btn-warning',
            outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
            secondary: 'btn-secondary',
            link: 'text-primary underline-offset-4 hover:underline',
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