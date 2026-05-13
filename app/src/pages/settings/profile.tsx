import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { GetServerSideProps } from "next";
import type { FormEvent } from "react";
import { Pencil } from "lucide-react";

import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { requireAuth } from "@/lib/auth-redirect";

export default function ProfilePage() {
  const { data, update } = useSession();
  const email = data?.user?.email ?? "—";
  const savedName = data?.user?.name ?? "";
  const [name, setName] = useState(savedName);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(savedName);
  }, [savedName]);

  const normalizedName = useMemo(() => name.trim().replace(/\s+/g, " "), [name]);
  const normalizedSavedName = useMemo(
    () => savedName.trim().replace(/\s+/g, " "),
    [savedName],
  );
  const canSave =
    normalizedName.length > 0 &&
    normalizedName !== normalizedSavedName &&
    !isSaving;

  function handleEditStart() {
    setName(savedName);
    setIsEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedName) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; user?: { name?: string } }
        | null;

      if (!response.ok) {
        return;
      }

      const nextName = payload?.user?.name ?? normalizedName;
      setName(nextName);
      await update?.({ name: nextName });
      setIsEditing(false);
    } catch {
      return;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
      <form onSubmit={handleSubmit} className="relative z-10">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card/80 p-4">
            {isEditing ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                  Name
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    placeholder="Your name"
                    autoComplete="name"
                    maxLength={80}
                  />
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="shrink-0 rounded-full border border-border/70 bg-card/70 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    Name
                  </p>
                  <p className="mt-2 truncate text-sm font-medium text-foreground">
                    {savedName || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEditStart}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-sm shadow-black/5 transition hover:bg-muted hover:text-foreground"
                  aria-label="Edit name"
                  title="Edit name"
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Email
            </p>
            <p className="mt-3 break-all text-sm font-medium text-foreground">
              {email}
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
