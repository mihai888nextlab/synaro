-- AlterTable
ALTER TABLE "ActivityLog" ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "entityName" TEXT;
