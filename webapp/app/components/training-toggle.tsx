import { Cross1Icon, MagicWandIcon, TrashIcon } from '@radix-ui/react-icons';
import { Button } from './button';
import { useTrainingStatus } from '~/util/trainingstatus.provider';

const TrainingToggle = ({ trainingId, imageGroupId }: { trainingId: string; imageGroupId?: string }) => {
    const { trainingStatuses } = useTrainingStatus();

    const training = trainingStatuses[trainingId]; // if statuses can't be found this will be undefined
    const isTraining = trainingStatuses[trainingId]?.runs?.length > 0;
    const isTrainingThisGroup = trainingStatuses[trainingId]?.runs?.find((run) => run.imageGroupId === imageGroupId);

    return !isTraining && !isTrainingThisGroup ? (
        <Button disabled={!training} icon={MagicWandIcon}>
            Start training
        </Button>
    ) : (
        <Button disabled={!training} icon={TrashIcon} display="ghost" variant="error">
            Abort training
        </Button>
    );
};

export default TrainingToggle;
