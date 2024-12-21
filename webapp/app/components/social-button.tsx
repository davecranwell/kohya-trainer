import { Form } from '@remix-run/react';

interface SocialButtonProps {
    provider: 'discord' | 'facebook' | 'github' | 'google' | 'microsoft';
    label: string;
}

export const SocialButton: React.FC<SocialButtonProps> = ({ provider, label }) => (
    <Form action={`/auth/${provider}`} method="post">
        <button>{label}</button>
    </Form>
);
