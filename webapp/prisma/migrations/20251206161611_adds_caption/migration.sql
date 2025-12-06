-- DropForeignKey
ALTER TABLE "ImageSize" DROP CONSTRAINT "ImageSize_imageGroupId_fkey";

-- AlterTable
ALTER TABLE "ImageSize" ADD COLUMN     "caption" TEXT;

-- AlterTable
ALTER TABLE "TrainingImage" ADD COLUMN     "caption" TEXT;

-- AddForeignKey
ALTER TABLE "ImageSize" ADD CONSTRAINT "ImageSize_imageGroupId_fkey" FOREIGN KEY ("imageGroupId") REFERENCES "ImageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
