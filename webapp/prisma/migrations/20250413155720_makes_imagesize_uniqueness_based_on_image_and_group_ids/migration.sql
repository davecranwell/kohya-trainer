/*
  Warnings:

  - The primary key for the `ImageSize` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ImageSize` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[imageId,imageGroupId]` on the table `ImageSize` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ImageSize_imageId_idx";

-- AlterTable
ALTER TABLE "ImageSize" DROP CONSTRAINT "ImageSize_pkey",
DROP COLUMN "id";

-- CreateIndex
CREATE UNIQUE INDEX "ImageSize_imageId_imageGroupId_key" ON "ImageSize"("imageId", "imageGroupId");
