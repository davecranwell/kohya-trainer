-- AlterTable
ALTER TABLE "TrainingRun" ADD COLUMN     "imageGroupId" TEXT;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_imageGroupId_fkey" FOREIGN KEY ("imageGroupId") REFERENCES "ImageGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
