-- Add lastActivityAt to Project for idle container detection
ALTER TABLE "Project" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
UPDATE "Project" SET "lastActivityAt" = "updatedAt";
