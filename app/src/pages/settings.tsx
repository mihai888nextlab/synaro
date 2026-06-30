import Link from "next/link";
import type { GetServerSideProps } from "next";

import { requireAuth } from "@/lib/auth-redirect";

export default function SettingsPage() {
  return (
    <div>
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <p className="text-sm text-muted-foreground">Settings</p>
        <p className="mt-2 text-muted-foreground">
          Placeholder settings. This will become workspace, security, and billing.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/settings/profile"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Profile
          </Link>
          <Link
            href="/settings/preferences"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Preferences
          </Link>
          <Link
            href="/settings/api-keys"
            className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            API keys
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {["Workspace", "Security", "Billing", "Integrations"].map((name) => (
            <div
              key={name}
              className="rounded-xl border border-border/70 bg-muted p-4"
            >
              <p className="font-medium">{name}</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {name === "Security" ? (
                  <Link href="/settings/api-keys" className="underline-offset-4 hover:underline">
                    Manage API keys
                  </Link>
                ) : (
                  "Coming soon"
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);

