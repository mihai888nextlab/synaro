import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { requireAuth } from "@/lib/auth-redirect";
import type { GetServerSideProps } from "next";

export default function ProjectsPage() {
  return (
    <div className="relative overflow-hidden">
      <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
      <div className="relative z-10 rounded-2xl border border-border/70 bg-card/80 p-6">
        <p className="text-sm text-muted-foreground">Projects</p>
        <p className="mt-2 text-muted-foreground">
          Placeholder list. This will become your projects table and actions.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {["Core Platform", "Customer A", "Customer B"].map((name) => (
            <div
              key={name}
              className="rounded-xl border border-border/70 bg-muted p-4"
            >
              <p className="font-medium">{name}</p>
              <p className="mt-1 text-sm text-muted-foreground/70">Last updated: just now</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);

