import { cn } from '#app/utils/misc.tsx';

export type StatusType = '' | 'pending' | 'active' | 'onerror' | 'completed';

interface StatusIndicatorProps {
    status: StatusType;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
    if (status === '') return null;

    const statusConfig = {
        pending: { bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', label: 'Pending' },
        active: { bgColor: 'bg-blue-100', textColor: 'text-blue-700', label: 'Active' },
        onerror: { bgColor: 'bg-red-100', textColor: 'text-red-700', label: 'Error' },
        completed: { bgColor: 'bg-green-100', textColor: 'text-green-700', label: 'Completed' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];

    return (
        <div className="mt-1 flex items-center gap-x-1.5">
            <span className={cn(`inline-flex items-center rounded-full ${config.bgColor} px-2 py-1 text-xs font-medium`, config.textColor)}>
                {config.label}
            </span>
        </div>
    );
}
