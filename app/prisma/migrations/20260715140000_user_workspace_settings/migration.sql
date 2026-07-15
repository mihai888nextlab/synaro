-- Per-user workspace defaults and session invalidation
ALTER TABLE "User" ADD COLUMN "idleStopMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "User" ADD COLUMN "defaultAgentModel" TEXT;
ALTER TABLE "User" ADD COLUMN "defaultAgentMaxSteps" INTEGER;
ALTER TABLE "User" ADD COLUMN "defaultAgentToolMode" TEXT;
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
