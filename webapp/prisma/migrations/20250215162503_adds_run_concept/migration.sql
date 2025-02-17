/*
  Warnings:

  - You are about to drop the column `status` on the `Training` table. All the data in the column will be lost.
  - Added the required column `runId` to the `TrainingStatus` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "TrainingStatus" DROP CONSTRAINT "TrainingStatus_trainingId_fkey";

-- AlterTable
ALTER TABLE "Training" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "TrainingStatus" ADD COLUMN     "runId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "TrainingRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,

    CONSTRAINT "TrainingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingRun_trainingId_idx" ON "TrainingRun"("trainingId");

-- CreateIndex
CREATE INDEX "TrainingStatus_runId_idx" ON "TrainingStatus"("runId");

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingStatus" ADD CONSTRAINT "TrainingStatus_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TrainingRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
