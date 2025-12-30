import * as React from 'react';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, placeholder, onBlur, defaultValue, ...props }: TextareaProps, ref) => {
        const [isDirty, setIsDirty] = useState(false);

        const handleChange = useCallback(
            (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                if (defaultValue === e.target.value) {
                    setIsDirty(false);
                } else {
                    setIsDirty(true);
                }
            },
            [setIsDirty],
        );

        const handleBlur = useCallback(
            (e: React.FocusEvent<HTMLTextAreaElement>) => {
                if (isDirty) {
                    onBlur?.(e);
                    setIsDirty(false);
                }
            },
            [onBlur, isDirty],
        );

        return (
            <textarea
                defaultValue={defaultValue}
                className={clsx(
                    `w-full rounded-lg border border-gray-800 bg-black/40 px-3 py-2 text-gray-200 placeholder-gray-500 transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-semantic-error`,
                    className,
                )}
                ref={ref}
                placeholder={isDirty ? '' : placeholder}
                onChange={handleChange}
                onBlur={handleBlur}
                {...props}
            />
        );
    },
);
Textarea.displayName = 'Textarea';

export { Textarea };
