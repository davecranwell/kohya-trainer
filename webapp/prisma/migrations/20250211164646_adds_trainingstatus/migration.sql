-- CreateTable
CREATE TABLE "TrainingStatus" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingStatus_trainingId_idx" ON "TrainingStatus"("trainingId");

-- AddForeignKey
ALTER TABLE "TrainingStatus" ADD CONSTRAINT "TrainingStatus_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
