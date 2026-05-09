-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('STOPPED', 'STARTING', 'RUNNING', 'ERROR');

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "containerId" TEXT,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'STOPPED',
    "port" INTEGER,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Execution_projectId_idx" ON "Execution"("projectId");
