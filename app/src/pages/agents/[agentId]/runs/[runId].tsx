import type { GetServerSideProps } from "next";

import { AgentRunDetailPageClient } from "@/components/ui/agents/agent-run-detail-page-client";
import { requireSession } from "@/lib/auth/require-session";
import { agentsRunDetailSeo, type PageSeoProps } from "@/lib/seo/page-seo";

type AgentRunDetailPageProps = {
  agentId: string;
  runId: string;
  agentName: string | null;
  seo: PageSeoProps;
};

export default function AgentRunDetailPage({
  agentId,
  runId,
  agentName,
}: AgentRunDetailPageProps) {
  return (
    <AgentRunDetailPageClient
      agentId={agentId}
      runId={runId}
      agentName={agentName ?? undefined}
    />
  );
}

export const getServerSideProps: GetServerSideProps<AgentRunDetailPageProps> = async (ctx) => {
  const auth = await requireSession(ctx);
  if ("redirect" in auth) return auth;

  const rawAgentId = ctx.params?.agentId;
  const rawRunId = ctx.params?.runId;
  const agentId =
    typeof rawAgentId === "string" ? rawAgentId : Array.isArray(rawAgentId) ? (rawAgentId[0] ?? "") : "";
  const runId =
    typeof rawRunId === "string" ? rawRunId : Array.isArray(rawRunId) ? (rawRunId[0] ?? "") : "";

  if (!agentId || !runId) {
    return { notFound: true };
  }

  const agentName =
    typeof ctx.query.agentName === "string" ? ctx.query.agentName : null;

  return {
    props: {
      agentId,
      runId,
      agentName,
      seo: agentsRunDetailSeo(agentId, runId, agentName ?? undefined),
    },
  };
};
