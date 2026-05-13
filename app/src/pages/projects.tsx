import type { GetServerSideProps } from "next";

import { ProjectsPageClient } from "@/components/ui/projects-page-client";
import { requireAuth } from "@/lib/auth-redirect";

export default function ProjectsPage() {
  return <ProjectsPageClient />;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
