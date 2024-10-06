/*
  Warnings:

  - You are about to drop the column `lastActiveAt` on the `Gpu` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Gpu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "trainingId" TEXT
);
INSERT INTO "new_Gpu" ("createdAt", "id", "instanceId", "status", "trainingId", "updatedAt") SELECT "createdAt", "id", "instanceId", "status", "trainingId", "updatedAt" FROM "Gpu";
DROP TABLE "Gpu";
ALTER TABLE "new_Gpu" RENAME TO "Gpu";
CREATE UNIQUE INDEX "Gpu_instanceId_key" ON "Gpu"("instanceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
