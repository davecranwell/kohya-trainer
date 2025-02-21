-- AlterTable
ALTER TABLE "Invite" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;
