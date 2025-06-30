import { Cross1Icon, MagicWandIcon, TrashIcon } from '@radix-ui/react-icons';
import { FetcherWithComponents } from 'react-router';
import { Button } from './button';
import { useTrainingStatus } from '~/util/trainingstatus.provider';

const TrainingToggle = ({
    trainingId,
    imageGroupId,
    fetcher,
}: {
    trainingId: string;
    imageGroupId?: string;
    fetcher: FetcherWithComponents<any>;
}) => {
    const { trainingStatuses } = useTrainingStatus();

    const training = trainingStatuses[trainingId]; // if statuses can't be found this will be undefined
    const isTraining = trainingStatuses[trainingId]?.runs?.length > 0;
    const isTrainingThisGroup = trainingStatuses[trainingId]?.runs?.find((run) => run.imageGroupId === imageGroupId);

    return !isTraining && !isTrainingThisGroup ? (
        <Button
            disabled={!training}
            icon={MagicWandIcon}
            onClick={() => fetcher.submit({ run: true }, { action: fetcher.formAction, method: 'post' })}>
            Train on this image set
        </Button>
    ) : (
        <Button
            disabled={!training}
            icon={TrashIcon}
            display="ghost"
            variant="error"
            onClick={() => fetcher.submit({ abort: true }, { action: fetcher.formAction, method: 'post' })}>
            Abort training
        </Button>
    );
};

export default TrainingToggle;
