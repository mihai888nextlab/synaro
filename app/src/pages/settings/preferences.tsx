import Link from "next/link";
import { Monitor, MoonStar, Sun } from "lucide-react";
import type { GetServerSideProps } from "next";

import { requireAuth } from "@/lib/auth-redirect";
import { useTheme, type ThemeMode } from "@/components/ui/theme-provider";

const options: Array<{
  mode: ThemeMode;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { mode: "system", title: "System", description: "Match your OS appearance", icon: Monitor },
  { mode: "dark", title: "Dark", description: "Dark surfaces and subtle borders", icon: MoonStar },
  { mode: "light", title: "Light", description: "Bright surfaces and crisp contrast", icon: Sun },
];

export default function PreferencesPage() {
  const { mode, resolvedMode, setMode } = useTheme();

  return (
    <div>
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Preferences</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Control your dashboard appearance. Current:{" "}
              <span className="font-medium text-foreground" suppressHydrationWarning>
                {mode === "system" ? `System (${resolvedMode})` : mode}
              </span>
              .
            </p>
          </div>

          <Link
            href="/settings"
            className="rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Back to settings
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {options.map((opt) => {
            const active = mode === opt.mode;
            const Icon = opt.icon;

            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setMode(opt.mode)}
                className={[
                  "group rounded-2xl border p-4 text-left transition",
                  active
                    ? "border-border bg-muted"
                    : "border-border/70 bg-background/40 hover:bg-muted",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card">
                      <Icon className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{opt.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground/80">{opt.description}</p>
                    </div>
                  </div>

                  <div
                    className={[
                      "size-4 rounded-full border transition",
                      active ? "border-foreground bg-foreground" : "border-border/80",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);

