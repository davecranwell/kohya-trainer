-- CreateTable
CREATE TABLE "ImageGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainingId" TEXT NOT NULL,

    CONSTRAINT "ImageGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageSize" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "imageGroupId" TEXT NOT NULL,
    "url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "x" INTEGER,
    "y" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageSize_imageId_idx" ON "ImageSize"("imageId");

-- AddForeignKey
ALTER TABLE "ImageGroup" ADD CONSTRAINT "ImageGroup_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageSize" ADD CONSTRAINT "ImageSize_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "TrainingImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageSize" ADD CONSTRAINT "ImageSize_imageGroupId_fkey" FOREIGN KEY ("imageGroupId") REFERENCES "ImageGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
