import type { GetServerSideProps } from "next";

import { AgentSharePageClient } from "@/components/ui/agents/agent-share-page-client";
import { fetchPublicAgent } from "@/lib/agent-service";
import { agentShareSeo, type PageSeoProps } from "@/lib/seo/page-seo";

type AgentSharePageProps = {
  agentId: string;
  agentName: string;
  agentDescription: string | null;
  agentTools: string[];
  agentEnabled: boolean;
  seo: PageSeoProps;
};

export default function AgentSharePage({
  agentId,
  agentName,
  agentDescription,
  agentTools,
  agentEnabled,
}: AgentSharePageProps) {
  return (
    <AgentSharePageClient
      agentId={agentId}
      agentName={agentName}
      agentDescription={agentDescription}
      agentTools={agentTools}
      agentEnabled={agentEnabled}
    />
  );
}

export const getServerSideProps: GetServerSideProps<AgentSharePageProps> = async (ctx) => {
  const raw = ctx.params?.agentId;
  const agentId = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  if (!agentId) {
    return { notFound: true };
  }

  const agent = await fetchPublicAgent(agentId);
  if (!agent) {
    return { notFound: true };
  }

  return {
    props: {
      agentId: agent.id,
      agentName: agent.name,
      agentDescription: agent.description ?? null,
      agentTools: agent.tools,
      agentEnabled: agent.enabled,
      seo: agentShareSeo(agent.id, agent.name, agent.description),
    },
  };
};
