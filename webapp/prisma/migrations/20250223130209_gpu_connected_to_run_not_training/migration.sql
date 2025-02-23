/*
  Warnings:

  - You are about to drop the column `trainingId` on the `Gpu` table. All the data in the column will be lost.
  - You are about to drop the column `gpuId` on the `Training` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gpuId]` on the table `TrainingRun` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Training" DROP CONSTRAINT "Training_gpuId_fkey";

-- DropIndex
DROP INDEX "Training_gpuId_key";

-- AlterTable
ALTER TABLE "Gpu" DROP COLUMN "trainingId",
ADD COLUMN     "trainingRunId" TEXT;

-- AlterTable
ALTER TABLE "Training" DROP COLUMN "gpuId";

-- AlterTable
ALTER TABLE "TrainingRun" ADD COLUMN     "gpuId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRun_gpuId_key" ON "TrainingRun"("gpuId");

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_gpuId_fkey" FOREIGN KEY ("gpuId") REFERENCES "Gpu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
