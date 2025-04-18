import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import clsx from 'clsx';

export type CheckboxProps = Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'type'> & {
    type?: string;
};

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(
    ({ className, ...props }, ref) => (
        <CheckboxPrimitive.Root
            ref={ref}
            className={clsx(
                'border-primary focus-visible:ring-ring data-[state=checked]:bg-primary focus-visible:outline-primary peer h-4 w-4 shrink-0 rounded-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:text-white',
                className,
            )}
            {...props}>
            <CheckboxPrimitive.Indicator className={clsx('flex items-center justify-center text-current')}>
                <svg viewBox="0 0 8 8">
                    <path d="M1,4 L3,6 L7,2" stroke="currentcolor" strokeWidth="1" fill="none" />
                </svg>
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    ),
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
