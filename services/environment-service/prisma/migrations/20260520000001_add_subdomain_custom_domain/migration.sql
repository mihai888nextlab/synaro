-- AlterTable: add subdomain and customDomain to Environment
ALTER TABLE "Environment" ADD COLUMN "subdomain" TEXT;
ALTER TABLE "Environment" ADD COLUMN "customDomain" TEXT;

-- CreateIndex: subdomain must be unique when set
CREATE UNIQUE INDEX "Environment_subdomain_key" ON "Environment"("subdomain");
