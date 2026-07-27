-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('INACTIVE', 'BUILDING', 'RUNNING', 'STOPPED', 'ERROR');

-- AlterTable: mirror the production deployment state on the project
ALTER TABLE "Project" ADD COLUMN "deploymentStatus" "DeploymentStatus" NOT NULL DEFAULT 'INACTIVE';
ALTER TABLE "Project" ADD COLUMN "deploymentUrl" TEXT;
