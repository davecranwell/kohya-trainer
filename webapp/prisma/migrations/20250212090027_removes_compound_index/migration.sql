-- DropIndex
DROP INDEX "TrainingStatus_trainingId_messageId_idx";

-- CreateIndex
CREATE INDEX "TrainingStatus_messageId_idx" ON "TrainingStatus"("messageId");
