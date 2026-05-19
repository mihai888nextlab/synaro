-- GitHub (or other) source URL for clone-on-provision; preview/runtime URL stays in repositoryLocation.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "cloneRepositoryUrl" TEXT;
