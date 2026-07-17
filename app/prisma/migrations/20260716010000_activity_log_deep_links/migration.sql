-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "agentId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "runId" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_agentId_createdAt_idx" ON "ActivityLog"("agentId", "createdAt" DESC);
