import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { requireAuth } from "@/lib/auth-redirect";
import type { GetServerSideProps } from "next";

export default function DashboardPage() {
  return (
    <div className="relative overflow-hidden">
      <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
      <div className="relative z-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { title: "Active projects", value: "3", hint: "Placeholder" },
          { title: "Deployments", value: "28", hint: "Last 7 days" },
          { title: "Alerts", value: "0", hint: "All clear" },
        ].map((card) => (
          <section
            key={card.title}
            className="rounded-2xl border border-border/70 bg-card/80 p-6"
          >
            <p className="text-sm text-muted-foreground">{card.title}</p>
            <p className="mt-6 text-4xl font-semibold tracking-tight">{card.value}</p>
            <p className="mt-2 text-sm text-muted-foreground/70">{card.hint}</p>
          </section>
        ))}
      </div>

      <section className="relative z-10 mt-6 rounded-2xl border border-border/70 bg-card/80 p-6">
        <p className="text-sm text-muted-foreground">Recent activity</p>
        <div className="mt-4 space-y-2">
          {["Provisioned staging environment", "Updated policy rules", "Deployed to prod"].map(
            (item) => (
              <div
                key={item}
                className="rounded-xl border border-border/70 bg-muted px-4 py-3 text-sm text-foreground"
              >
                {item}
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);

