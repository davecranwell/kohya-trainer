-- CreateTable
CREATE TABLE "Gpu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainingId" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Training" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "triggerWord" TEXT NOT NULL DEFAULT 'oxhw',
    "baseModel" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gpuInstanceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Training_gpuInstanceId_fkey" FOREIGN KEY ("gpuInstanceId") REFERENCES "Gpu" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Training_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Training" ("baseModel", "config", "createdAt", "id", "name", "ownerId", "triggerWord", "updatedAt") SELECT "baseModel", "config", "createdAt", "id", "name", "ownerId", "triggerWord", "updatedAt" FROM "Training";
DROP TABLE "Training";
ALTER TABLE "new_Training" RENAME TO "Training";
CREATE UNIQUE INDEX "Training_gpuInstanceId_key" ON "Training"("gpuInstanceId");
CREATE INDEX "Training_ownerId_idx" ON "Training"("ownerId");
CREATE INDEX "Training_ownerId_updatedAt_idx" ON "Training"("ownerId", "updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Gpu_instanceId_key" ON "Gpu"("instanceId");
