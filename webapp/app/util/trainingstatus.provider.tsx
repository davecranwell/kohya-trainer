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
            const newStatuses = { ...prev };
            if (event) {
                const eventData = JSON.parse(event);

                if (Array.isArray(eventData)) {
                    eventData.forEach((status) => {
                        newStatuses[status.trainingId] = status;
                    });
                } else if (eventData.trainingId) {
                    newStatuses[eventData.trainingId] = eventData;
                }
            }
            return newStatuses;
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
