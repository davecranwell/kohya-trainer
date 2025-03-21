import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

const labelVariants = cva('block font-medium text-gray-300 mb-2');

const Label = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => <LabelPrimitive.Root ref={ref} className={clsx(labelVariants(), className)} {...props} />);
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
