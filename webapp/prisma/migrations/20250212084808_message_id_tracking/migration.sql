-- DropIndex
DROP INDEX "TrainingStatus_trainingId_idx";

-- AlterTable
ALTER TABLE "TrainingStatus" ADD COLUMN     "messageId" TEXT;

-- CreateIndex
CREATE INDEX "TrainingStatus_trainingId_messageId_idx" ON "TrainingStatus"("trainingId", "messageId");
