-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('INACTIVE', 'BUILDING', 'RUNNING', 'STOPPED', 'ERROR');

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "containerId" TEXT,
    "image" TEXT NOT NULL DEFAULT 'node:20-alpine',
    "status" "DeploymentStatus" NOT NULL DEFAULT 'INACTIVE',
    "subdomain" TEXT,
    "customDomain" TEXT,
    "commitSha" TEXT,
    "runCommand" TEXT,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_projectId_key" ON "Deployment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_subdomain_key" ON "Deployment"("subdomain");

-- CreateIndex
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");
