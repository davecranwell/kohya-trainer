import React, { useId } from 'react';
import clsx from 'clsx';
import { Fieldset as FieldsetHeadless } from '@headlessui/react';

import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';

export type ListOfErrors = Array<string | null | undefined> | null | undefined;

export function ErrorList({ id, errors }: { errors?: ListOfErrors; id?: string }) {
    const errorsToRender = errors?.filter(Boolean);
    if (!errorsToRender?.length) return null;
    return (
        <ul id={id} className="flex flex-col gap-1">
            {errorsToRender.map((e) => (
                <li key={e} className="text-red-500">
                    {e}
                </li>
            ))}
        </ul>
    );
}

export function Fieldset({ children, className }: { children: React.ReactNode; className?: string }) {
    return <FieldsetHeadless className={clsx('space-y-6', className)}>{children}</FieldsetHeadless>;
}

export function Field({
    labelProps,
    inputProps,
    errors,
    className,
    help,
}: {
    labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
    inputProps: React.InputHTMLAttributes<HTMLInputElement>;
    errors?: ListOfErrors;
    className?: string;
    help?: React.ReactNode;
}) {
    const fallbackId = useId();
    const id = inputProps.id ?? fallbackId;
    const errorId = errors?.length ? `${id}-error` : undefined;

    return (
        <div className={clsx('w-full', className)}>
            <Label htmlFor={id} {...labelProps} />
            <Input id={id} aria-invalid={errorId ? true : undefined} aria-describedby={errorId} {...inputProps} />
            {help && <p className="mt-3 text-sm text-gray-500">{help}</p>}
            {errorId && (
                <div className="pt-1">
                    <ErrorList id={errorId} errors={errors} />
                </div>
            )}
        </div>
    );
}

export function TextareaField({
    labelProps,
    textareaProps,
    errors,
    className,
    help,
}: {
    labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
    textareaProps: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
    errors?: ListOfErrors;
    className?: string;
    help?: string;
}) {
    const fallbackId = useId();
    const id = textareaProps.id ?? textareaProps.name ?? fallbackId;
    const errorId = errors?.length ? `${id}-error` : undefined;
    return (
        <div className={className}>
            <Label htmlFor={id} {...labelProps} />
            <Textarea id={id} aria-invalid={errorId ? true : undefined} aria-describedby={errorId} {...textareaProps} />
            {help && <p className="mt-3 text-sm text-gray-500">{help}</p>}
            <div className="pt-1">{errorId ? <ErrorList id={errorId} errors={errors} /> : null}</div>
        </div>
    );
}
