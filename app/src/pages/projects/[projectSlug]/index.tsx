import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";

import { ProjectWorkspace } from "@/components/ui/project-workspace";
import { requireAuth } from "@/lib/auth-redirect";

export default function ProjectWorkspacePage() {
  const router = useRouter();
  const raw = router.query.projectSlug;
  const slug =
    typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";

  if (!router.isReady) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <ProjectWorkspace projectSlug={slug} />;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
