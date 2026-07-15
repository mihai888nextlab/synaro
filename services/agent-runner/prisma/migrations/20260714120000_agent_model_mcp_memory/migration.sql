-- AlterTable: per-agent model selection + MCP server config
ALTER TABLE "Agent" ADD COLUMN "model" TEXT;
ALTER TABLE "Agent" ADD COLUMN "mcpServers" JSONB;

-- CreateTable: durable per-agent key/value memory
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentMemory_agentId_key_key" ON "AgentMemory"("agentId", "key");

-- CreateIndex
CREATE INDEX "AgentMemory_agentId_idx" ON "AgentMemory"("agentId");

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
