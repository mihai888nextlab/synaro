import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/next-auth-options";
import { AgentsPageClient } from "@/components/ui/agents-page-client";

export default function AgentsPage() {
  return <AgentsPageClient />;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { props: {} };
};
