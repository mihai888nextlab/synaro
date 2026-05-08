import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { requireAuth } from "@/lib/auth-redirect";
import type { GetServerSideProps } from "next";

export default function LogsPage() {
  return (
    <div className="relative overflow-hidden">
      <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
      <div className="relative z-10 rounded-2xl border border-border/70 bg-card/80 p-6">
        <p className="text-sm text-muted-foreground">Logs</p>
        <p className="mt-2 text-muted-foreground">
          Placeholder view. This will become a searchable log stream.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {[
            "INFO  Provision started: env=staging",
            "INFO  Applied policy checks",
            "OK    Deployment finished successfully",
          ].map((line) => (
            <div
              key={line}
              className="rounded-xl border border-border/70 bg-muted px-4 py-3 font-mono text-xs text-foreground"
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);

