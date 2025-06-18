import { PlusIcon } from '@radix-ui/react-icons';
import { NavLink } from 'react-router';
import { Button } from './button';

export function EmptyState({
    actionUrl,
    actionText = 'Create',
    ctaText = 'Create a new thing',
    noun = 'things',
    items = [],
    ...props
}: {
    actionUrl: string;
    actionText: string;
    ctaText: string;
    noun: string;
    items: any[];
}) {
    return (
        <div className="p-12 text-center" {...props}>
            {!items.length && (
                <div className="mb-6">
                    <h3 className="mt-2 text-sm font-semibold">You have no {noun}</h3>
                    <p className="mt-1 text-sm text-gray-500">{ctaText}</p>
                </div>
            )}

            <NavLink to={actionUrl}>
                <Button icon={PlusIcon} size="lg">
                    {actionText}
                </Button>
            </NavLink>
        </div>
    );
}
