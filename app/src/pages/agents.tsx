import type { GetServerSideProps } from "next";

import { requireSession } from "@/lib/auth/require-session";
import { AgentsPageClient } from "@/components/ui/agents-page-client";
import { agentsPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

type AgentsPageProps = { seo: PageSeoProps };

export default function AgentsPage() {
  return <AgentsPageClient />;
}

export const getServerSideProps: GetServerSideProps<AgentsPageProps> = async (ctx) => {
  const auth = await requireSession(ctx);
  if ("redirect" in auth) return auth;

  const highlight =
    typeof ctx.query.highlight === "string"
      ? ctx.query.highlight
      : typeof ctx.query.agentId === "string"
        ? ctx.query.agentId
        : undefined;

  return { props: { seo: agentsPageSeo(highlight) } };
};
