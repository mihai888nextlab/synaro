import type { GetServerSideProps } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DashboardKpiStrip } from "@/components/ui/dashboard-kpi-strip";
import { DashboardLogsTable } from "@/components/ui/dashboard-logs-table";
import { DashboardProjectsShowcase } from "@/components/ui/dashboard-projects-showcase";
import { useState, type FormEvent } from "react";
import { Plus, Loader2 } from "lucide-react";
import type { GetServerSideProps } from "next";

import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { requireAuth } from "@/lib/auth-redirect";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { projects, loading, error, refetch } = useProjects();
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    const form = event.currentTarget;
    const name = (new FormData(form).get("name") as string)?.trim();
    const description = (new FormData(form).get("description") as string)?.trim() || undefined;
    const userId = session?.user?.id;
    if (!name || !userId) return;

    setCreating(true);
    try {
      await createProject({ name, description, userId });
      setShowModal(false);
      form.reset();
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="relative overflow-hidden">
      <PageBackgroundPattern variant="section" className="pointer-events-none absolute inset-0 z-0 opacity-60" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 sm:gap-10">
        <DashboardKpiStrip />

        <DashboardProjectsShowcase />

        <DashboardLogsTable
          headerEnd={
            <Button variant="outline" size="sm" className="rounded-xl text-muted-foreground" asChild>
              <Link href="/logs">View logs</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
