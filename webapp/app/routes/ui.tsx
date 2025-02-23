import { useState } from 'react';
import { CheckCircledIcon, ExclamationTriangleIcon, CrossCircledIcon, InfoCircledIcon } from '@radix-ui/react-icons';

import { Button } from '~/components/button';
import { Field, TextareaField } from '~/components/forms';

export default function Ui() {
    const [emailNotifications, setEmailNotifications] = useState(false);
    const [pushNotifications, setPushNotifications] = useState(false);

    return (
        <div>
            <section className="space-y-6">
                <h2 className="mb-6 bg-gradient-to-r from-primary via-accent1 to-accent2 bg-clip-text text-2xl font-bold text-transparent">
                    Color Palette
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                        <div className="h-20 rounded-lg bg-primary shadow-lg"></div>
                        <p className="text-sm font-medium">Primary (Violet)</p>
                        <div className="flex gap-2">
                            <div className="h-8 w-full rounded bg-primary-light"></div>
                            <div className="h-8 w-full rounded bg-primary"></div>
                            <div className="h-8 w-full rounded bg-primary-dark"></div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="h-20 rounded-lg bg-accent1 shadow-lg"></div>
                        <p className="text-sm font-medium">Accent 1 (Cyan)</p>
                        <div className="flex gap-2">
                            <div className="h-8 w-full rounded bg-accent1-light"></div>
                            <div className="h-8 w-full rounded bg-accent1"></div>
                            <div className="h-8 w-full rounded bg-accent1-dark"></div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="h-20 rounded-lg bg-accent2 shadow-lg"></div>
                        <p className="text-sm font-medium">Accent 2 (Amber)</p>
                        <div className="flex gap-2">
                            <div className="h-8 w-full rounded bg-accent2-light"></div>
                            <div className="h-8 w-full rounded bg-accent2"></div>
                            <div className="h-8 w-full rounded bg-accent2-dark"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Status Colors Section */}
            <section className="space-y-6">
                <h2 className="mb-6 bg-gradient-to-r from-primary to-accent1 bg-clip-text text-2xl font-bold text-transparent">Status Indicators</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-semantic-success bg-black/40 p-4 backdrop-blur-sm">
                        <div className="mb-2 flex items-center gap-2">
                            <CheckCircledIcon className="text-semantic-success" />
                            <span className="font-medium text-semantic-success">Success</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-6 w-full rounded bg-semantic-success-light"></div>
                            <div className="h-6 w-full rounded bg-semantic-success"></div>
                            <div className="h-6 w-full rounded bg-semantic-success-dark"></div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-semantic-info bg-black/40 p-4 backdrop-blur-sm">
                        <div className="mb-2 flex items-center gap-2">
                            <InfoCircledIcon className="text-semantic-info" />
                            <span className="font-medium text-semantic-info">Info</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-6 w-full rounded bg-semantic-info-light"></div>
                            <div className="h-6 w-full rounded bg-semantic-info"></div>
                            <div className="h-6 w-full rounded bg-semantic-info-dark"></div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-semantic-warning bg-black/40 p-4 backdrop-blur-sm">
                        <div className="mb-2 flex items-center gap-2">
                            <ExclamationTriangleIcon className="text-semantic-warning" />
                            <span className="font-medium text-semantic-warning">Warning</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-6 w-full rounded bg-semantic-warning-light"></div>
                            <div className="h-6 w-full rounded bg-semantic-warning"></div>
                            <div className="h-6 w-full rounded bg-semantic-warning-dark"></div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-semantic-error bg-black/40 p-4 backdrop-blur-sm">
                        <div className="mb-2 flex items-center gap-2">
                            <CrossCircledIcon className="text-semantic-error" />
                            <span className="font-medium text-semantic-error">Error</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-6 w-full rounded bg-semantic-error-light"></div>
                            <div className="h-6 w-full rounded bg-semantic-error"></div>
                            <div className="h-6 w-full rounded bg-semantic-error-dark"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Rest of the existing sections */}
            {/* Typography Section */}
            <section className="space-y-4">
                <h2 className="mb-6 bg-gradient-to-r from-primary via-accent1 to-accent2 bg-clip-text text-2xl font-bold text-transparent">
                    Typography
                </h2>
                <h1 className="text-4xl font-bold text-gray-100">Heading 1</h1>
                <h2 className="text-3xl font-semibold text-gray-200">Heading 2</h2>
                <h3 className="text-2xl font-medium text-gray-300">Heading 3</h3>
                <p className="text-xl leading-relaxed text-white">
                    Large text paragraph with some longer text to demonstrate how it wraps and flows. The quick brown fox jumps over the lazy dog.
                </p>
                <p className="text-lg leading-relaxed text-white">
                    Large text paragraph with some longer text to demonstrate how it wraps and flows. The quick brown fox jumps over the lazy dog.
                </p>
                <p className="text-base leading-relaxed">
                    Regular paragraph with some longer text to demonstrate how it wraps and flows. The quick brown fox jumps over the lazy dog.
                </p>
            </section>

            {/* Buttons Section */}
            <section className="space-y-4">
                <h2 className="mb-6 bg-gradient-to-r from-primary via-accent1 to-accent2 bg-clip-text text-2xl font-bold text-transparent">
                    Buttons
                </h2>
                <div className="flex flex-wrap gap-4">
                    <Button variant="default">Primary Button</Button>
                    <Button variant="secondary">Secondary Button</Button>
                    <Button variant="tertiary">Tertiary Button</Button>
                    <Button variant="ghost">Ghost Button</Button>
                </div>
            </section>

            {/* Status Buttons */}
            <div className="flex flex-wrap gap-4">
                <Button variant="success">
                    <CheckCircledIcon className="mr-2" />
                    Success
                </Button>
                <Button variant="info">
                    <InfoCircledIcon className="mr-2" />
                    Info
                </Button>
                <Button variant="warning">
                    <ExclamationTriangleIcon className="mr-2" />
                    Warning
                </Button>
                <Button variant="error">
                    <CrossCircledIcon className="mr-2" />
                    Error
                </Button>
            </div>

            {/* Button Sizes Section */}
            <section className="space-y-4">
                <h2 className="mb-6 bg-gradient-to-r from-primary via-accent1 to-accent2 bg-clip-text text-2xl font-bold text-transparent">
                    Button Sizes
                </h2>

                {/* Default size */}
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">Default Size</p>
                    <div className="flex flex-wrap gap-4">
                        <Button variant="default" size="default">
                            Default Button
                        </Button>
                    </div>
                </div>

                {/* Small size */}
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">Small Size</p>
                    <div className="flex flex-wrap gap-4">
                        <Button variant="default" size="sm">
                            Small Button
                        </Button>
                    </div>
                </div>

                {/* Large size */}
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">Large Size</p>
                    <div className="flex flex-wrap gap-4">
                        <Button variant="default" size="lg">
                            Large Button
                        </Button>
                    </div>
                </div>

                {/* Wide size */}
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">Wide Size</p>
                    <div className="flex flex-wrap gap-4">
                        <Button variant="default" size="wide">
                            Wide Button
                        </Button>
                    </div>
                </div>

                {/* Pill size */}
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">Pill Size</p>
                    <div className="flex flex-wrap gap-4">
                        <Button variant="default" size="pill">
                            Pill Button
                        </Button>
                    </div>
                </div>

                {/* Icon size */}
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">Icon Size</p>
                    <div className="flex flex-wrap gap-4">
                        <Button variant="default" size="icon">
                            <CheckCircledIcon />
                        </Button>
                        <Button variant="ghost" size="icon">
                            <InfoCircledIcon />
                        </Button>
                    </div>
                </div>

                {/* Size comparison */}
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">Size Comparison</p>
                    <div className="flex flex-wrap items-center gap-4">
                        <Button variant="default" size="sm">
                            Small
                        </Button>
                        <Button variant="default" size="default">
                            Default
                        </Button>
                        <Button variant="default" size="lg">
                            Large
                        </Button>
                    </div>
                </div>
            </section>

            {/* Form Components Section */}
            <section className="space-y-8 rounded-xl border border-gray-800 bg-black/40 p-6 backdrop-blur-sm">
                <h2 className="bg-gradient-to-r from-primary via-accent1 to-accent2 bg-clip-text text-2xl font-bold text-transparent">
                    Form Components
                </h2>

                <div className="space-y-4">
                    {/* Email Input */}
                    <Field
                        labelProps={{
                            children: 'Email Address',
                        }}
                        inputProps={{
                            type: 'email',
                            placeholder: 'you@example.com',
                        }}
                        help="We'll never share your email with anyone else."
                    />

                    {/* Password Input with Error */}
                    <Field
                        labelProps={{
                            children: 'Password',
                        }}
                        inputProps={{
                            type: 'password',
                            placeholder: 'Enter your password',
                        }}
                        errors={['Password must be at least 8 characters']}
                    />

                    {/* Message Textarea */}
                    <TextareaField
                        labelProps={{
                            children: 'Message',
                        }}
                        textareaProps={{
                            placeholder: 'Type your message here...',
                            rows: 4,
                        }}
                    />

                    {/* Notification Preferences */}
                    <div className="space-y-4">
                        <p className="text-base font-medium">Notification Preferences</p>
                        <p className="text-sm text-gray-500">Choose how you'd like to be notified</p>

                        <div className="space-y-2">
                            {/* <CheckboxField
                                labelProps={{
                                    children: 'Email notifications',
                                }}
                                buttonProps={{
                                    name: 'emailNotifications',
                                    form: 'notificationForm',
                                    checked: emailNotifications,
                                    onCheckedChange: (checked) => setEmailNotifications(checked as boolean),
                                }}
                            />

                            <CheckboxField
                                labelProps={{
                                    children: 'Push notifications',
                                }}
                                buttonProps={{
                                    name: 'pushNotifications',
                                    form: 'notificationForm',
                                    checked: pushNotifications,
                                    onCheckedChange: (checked) => setPushNotifications(checked as boolean),
                                }}
                            /> */}
                        </div>
                    </div>

                    <Button variant="default" className="w-full">
                        Submit Form
                    </Button>
                </div>
            </section>
        </div>
    );
}
