import { useEffect, useState, createContext, useContext } from 'react';
import { useEventSource } from 'remix-utils/sse/react';
import { Training, User } from '@prisma/client';

type TrainingSummary = {
    id: string;
    runs: {
        id: string;
        status: string;
        imageGroupId: string | null;
    }[];
};

type TrainingStatusProviderType = {
    trainingStatuses: Record<string, TrainingSummary>;
};

export const TrainingStatusContext = createContext<TrainingStatusProviderType | null>(null);

/**
 * This provider is used to provide the training statuses for all known trainingsto the app.
 * It uses the EventSourceProvider to subscribe to the SSE endpoint and update the training statuses.
 * When first initialised it should be provided with all trainings through `initialTrainings`.
 * It then subscribes to the event source which only returns a single training at a time, that it merges
 * with the initialtrainings
 */
export function TrainingStatusProvider({
    children,
    user,
    initialTrainings,
}: {
    children: React.ReactNode;
    user: User | null;
    initialTrainings: Record<string, TrainingSummary>;
}) {
    const event = useEventSource(`/sse/${user?.id}`, { event: user?.id });
    const [trainingStatuses, setTrainingStatuses] = useState<Record<string, TrainingSummary>>({});

    useEffect(() => {
        setTrainingStatuses(initialTrainings);
    }, [initialTrainings]);

    useEffect(() => {
        setTrainingStatuses((prev) => {
            if (event) {
                const eventData = JSON.parse(event);
                return { ...prev, ...eventData };
            }

            return prev;
        });
    }, [event]);

    return <TrainingStatusContext.Provider value={{ trainingStatuses }}>{children}</TrainingStatusContext.Provider>;
}

export function useTrainingStatus() {
    const context = useContext(TrainingStatusContext);
    if (!context) {
        throw new Error('useTrainingStatus must be used within a TrainingStatusProvider');
    }

    return context;
}
