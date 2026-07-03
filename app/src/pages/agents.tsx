import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/next-auth-options";
import { AgentsPageClient } from "@/components/ui/agents-page-client";
import { agentsPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

type AgentsPageProps = { seo: PageSeoProps };

export default function AgentsPage() {
  return <AgentsPageClient />;
}

export const getServerSideProps: GetServerSideProps<AgentsPageProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const highlight =
    typeof ctx.query.highlight === "string"
      ? ctx.query.highlight
      : typeof ctx.query.agentId === "string"
        ? ctx.query.agentId
        : undefined;

  return { props: { seo: agentsPageSeo(highlight) } };
};
