import { Form } from 'react-router';
import { FaGoogle, FaDiscord, FaFacebook } from 'react-icons/fa';
import { Button } from './button';

interface SocialButtonProps {
    provider: 'discord' | 'facebook' | 'github' | 'google' | 'microsoft';
    label: string;
}

export const SocialButton: React.FC<SocialButtonProps> = ({ provider, label }) => (
    <Form action={`/auth/${provider}`} method="post">
        <Button size="full" display="ghost" className="flex items-center gap-2">
            <span>{provider === 'discord' && <FaDiscord className="h-6 p-0" />}</span>
            <span>{label}</span>
        </Button>
    </Form>
);
