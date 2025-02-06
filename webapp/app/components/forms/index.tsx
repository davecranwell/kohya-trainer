import React, { useId } from 'react';
import { useInputControl } from '@conform-to/react';
import clsx from 'clsx';
import { REGEXP_ONLY_DIGITS_AND_CHARS, type OTPInputProps } from 'input-otp';
import { Fieldset as FieldsetHeadless } from '@headlessui/react';
import { Field as HeadlessField, Label as HeadlessLabel, Radio, RadioGroup } from '@headlessui/react';

import { Button } from '../button';
import { Checkbox, type CheckboxProps } from './checkbox';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from './input-otp';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { MultiComboBox, type Option } from './multi-combo-box';

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

// export function ComboBoxField({
//     labelProps,
//     inputProps,
//     errors,
//     className,
//     options,
//     help,
// }: {
//     labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
//     inputProps: React.InputHTMLAttributes<HTMLInputElement>;
//     errors?: ListOfErrors;
//     className?: string;
//     options: Option[];
//     help?: string;
// }) {
//     const fallbackId = useId();
//     const id = inputProps.id ?? fallbackId;
//     const errorId = errors?.length ? `${id}-error` : undefined;
//     return (
//         <div className={className}>
//             <Label htmlFor={id} {...labelProps} />
//             <MultiComboBox
//                 name={inputProps.name ?? id}
//                 options={options && options.length > 0 ? options : []}
//                 id={id}
//                 aria-invalid={errorId ? true : undefined}
//                 aria-describedby={errorId}
//                 {...inputProps}
//             />
//             {help && <p className="mt-3 text-sm text-gray-500">{help}</p>}
//             <div className="pt-1">{errorId ? <ErrorList id={errorId} errors={errors} /> : null}</div>
//         </div>
//     );
// }

// export function OTPField({
//     labelProps,
//     inputProps,
//     errors,
//     className,
// }: {
//     labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
//     inputProps: Partial<OTPInputProps & { render: never }>;
//     errors?: ListOfErrors;
//     className?: string;
// }) {
//     const fallbackId = useId();
//     const id = inputProps.id ?? fallbackId;
//     const errorId = errors?.length ? `${id}-error` : undefined;
//     return (
//         <div className={className}>
//             <Label htmlFor={id} {...labelProps} />
//             <InputOTP
//                 pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
//                 maxLength={6}
//                 id={id}
//                 aria-invalid={errorId ? true : undefined}
//                 aria-describedby={errorId}
//                 {...inputProps}>
//                 <InputOTPGroup>
//                     <InputOTPSlot index={0} />
//                     <InputOTPSlot index={1} />
//                     <InputOTPSlot index={2} />
//                 </InputOTPGroup>
//                 <InputOTPSeparator />
//                 <InputOTPGroup>
//                     <InputOTPSlot index={3} />
//                     <InputOTPSlot index={4} />
//                     <InputOTPSlot index={5} />
//                 </InputOTPGroup>
//             </InputOTP>
//             <div className="pt-1">{errorId ? <ErrorList id={errorId} errors={errors} /> : null}</div>
//         </div>
//     );
// }

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

// export function CheckboxField({
//     labelProps,
//     buttonProps,
//     errors,
//     className,
//     help,
// }: {
//     labelProps: JSX.IntrinsicElements['label'];
//     buttonProps: CheckboxProps & {
//         name: string;
//         form: string;
//         value?: string;
//     };
//     errors?: ListOfErrors;
//     className?: string;
//     help?: string;
// }) {
//     const { key, defaultChecked, ...checkboxProps } = buttonProps;
//     const fallbackId = useId();
//     const checkedValue = buttonProps.value ?? 'on';
//     const input = useInputControl({
//         key,
//         name: buttonProps.name,
//         formId: buttonProps.form,
//         initialValue: defaultChecked ? checkedValue : undefined,
//     });
//     const id = buttonProps.id ?? fallbackId;
//     const errorId = errors?.length ? `${id}-error` : undefined;

//     return (
//         <div className={className}>
//             <div className="flex items-center gap-2">
//                 <Checkbox
//                     {...checkboxProps}
//                     id={id}
//                     aria-invalid={errorId ? true : undefined}
//                     aria-describedby={errorId}
//                     checked={input.value === checkedValue}
//                     onCheckedChange={(state) => {
//                         input.change(state.valueOf() ? checkedValue : '');
//                         buttonProps.onCheckedChange?.(state);
//                     }}
//                     onFocus={(event) => {
//                         input.focus();
//                         buttonProps.onFocus?.(event);
//                     }}
//                     onBlur={(event) => {
//                         input.blur();
//                         buttonProps.onBlur?.(event);
//                     }}
//                     type="button"
//                 />
//                 <Label htmlFor={id} {...labelProps} className="mb-0" />
//             </div>
//             {help && <p className="mt-3 text-sm text-gray-500">{help}</p>}
//             <div className="pt-1">{errorId ? <ErrorList id={errorId} errors={errors} /> : null}</div>
//         </div>
//     );
// }
