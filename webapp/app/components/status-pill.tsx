import { UpdateIcon } from '@radix-ui/react-icons';

export const StatusPill = ({ status, className }: { status: string; className?: string }) => {
    if (!status) return null;

    const statusText = status === 'completed' ? 'Completed' : status === 'failed' ? 'Failed' : 'Training';

    return (
        <div
            className={`align-center flex gap-2 rounded-full px-2 py-1 text-xs text-white ${className} ${
                status === 'completed'
                    ? 'bg-green-500'
                    : status === 'failed'
                      ? 'bg-red-500'
                      : status === 'started'
                        ? 'bg-semantic-info'
                        : 'bg-semantic-info'
            }`}>
            {status === 'started' && <UpdateIcon className="h-4 w-4 animate-spin" />}
            <span className="text-shadow-xs text-xs font-semibold uppercase">{statusText}</span>
        </div>
    );
};
