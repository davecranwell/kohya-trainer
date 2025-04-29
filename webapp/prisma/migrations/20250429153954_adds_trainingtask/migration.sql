/*
  Warnings:

  - You are about to drop the column `messageId` on the `TrainingStatus` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "TrainingStatus_messageId_idx";

-- AlterTable
ALTER TABLE "TrainingStatus" DROP COLUMN "messageId";

-- CreateTable
CREATE TABLE "TrainingTask" (
    "id" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dataJson" JSONB,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingTask_messageId_idx" ON "TrainingTask"("messageId");

-- CreateIndex
CREATE INDEX "TrainingTask_runId_idx" ON "TrainingTask"("runId");
