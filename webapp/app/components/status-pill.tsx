export const StatusPill = ({ status, className }: { status: string; className?: string }) => {
    if (!status) return null;

    const statusText = status === 'completed' ? 'Completed' : status === 'failed' ? 'Failed' : 'Training';

    return (
        <div
            className={`rounded-full px-2 py-1 text-xs text-white ${className} ${
                status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-semantic-info'
            }`}>
            <span className="text-shadow-xs text-xs font-semibold uppercase">{statusText}</span>
            <Cross1Icon />
        </div>
    );
};
