-- Auto vs manual tool selection; runtime MCP credential prompts
ALTER TABLE "Agent" ADD COLUMN "toolMode" TEXT NOT NULL DEFAULT 'auto';
UPDATE "Agent" SET "toolMode" = 'manual' WHERE cardinality("tools") > 0;

ALTER TABLE "AgentRun" ADD COLUMN "credentialRequest" JSONB;
