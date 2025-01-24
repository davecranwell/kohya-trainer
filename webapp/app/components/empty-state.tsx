import { PlusIcon } from '@radix-ui/react-icons';
import { NavLink } from 'react-router';
import { Button } from './button';

export function EmptyState({
    actionUrl,
    actionText = 'Create',
    ctaText = 'Create a new thing',
    noun = 'things',
    ...props
}: {
    actionUrl: string;
    actionText: string;
    ctaText: string;
    noun: string;
}) {
    return (
        <div className="p-12 text-center" {...props}>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">You have no {noun}</h3>
            <p className="mt-1 text-sm text-gray-500">{ctaText}</p>
            <div className="mt-6">
                <NavLink to={actionUrl}>
                    <Button>
                        <PlusIcon aria-hidden="true" className="-ml-0.5 mr-1.5 h-5 w-5" />
                        {actionText}
                    </Button>
                </NavLink>
            </div>
        </div>
    );
}
