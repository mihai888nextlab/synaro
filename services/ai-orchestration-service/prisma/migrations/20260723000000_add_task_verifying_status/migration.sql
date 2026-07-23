-- Add the VERIFYING status used by the health-check phase of the multi-agent orchestration.
-- (Postgres 12+ allows ADD VALUE inside a migration transaction; the value is usable after commit.)
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'VERIFYING' BEFORE 'DONE';
