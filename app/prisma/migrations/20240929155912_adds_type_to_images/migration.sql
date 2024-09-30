/*
  Warnings:

  - Added the required column `type` to the `TrainingImage` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrainingImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "trainingId" TEXT NOT NULL,
    CONSTRAINT "TrainingImage_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TrainingImage" ("createdAt", "id", "name", "text", "trainingId", "updatedAt", "url") SELECT "createdAt", "id", "name", "text", "trainingId", "updatedAt", "url" FROM "TrainingImage";
DROP TABLE "TrainingImage";
ALTER TABLE "new_TrainingImage" RENAME TO "TrainingImage";
CREATE INDEX "TrainingImage_trainingId_idx" ON "TrainingImage"("trainingId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
