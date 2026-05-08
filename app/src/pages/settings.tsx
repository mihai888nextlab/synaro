import Link from "next/link";
import type { GetServerSideProps } from "next";

import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { requireAuth } from "@/lib/auth-redirect";

export default function SettingsPage() {
  return (
    <div className="relative overflow-hidden">
      <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
      <div className="relative z-10 rounded-2xl border border-border/70 bg-card/80 p-6">
        <p className="text-sm text-muted-foreground">Settings</p>
        <p className="mt-2 text-muted-foreground">
          Placeholder settings. This will become workspace, security, and billing.
        </p>

        <div className="mt-6">
          <Link
            href="/settings/preferences"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Preferences
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {["Workspace", "Security", "Billing", "Integrations"].map((name) => (
            <div
              key={name}
              className="rounded-xl border border-border/70 bg-muted p-4"
            >
              <p className="font-medium">{name}</p>
              <p className="mt-1 text-sm text-muted-foreground/70">Coming soon</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);

