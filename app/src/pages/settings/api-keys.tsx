import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import type { GetServerSideProps } from "next";

import { requireAuth } from "@/lib/auth-redirect";
import { readJsonResponse } from "@/lib/read-json-response";

type ApiKeyRow = {
  key_id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

type CreatedKey = ApiKeyRow & { secret: string };

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/api-keys");
      const data = await readJsonResponse<{ keys?: ApiKeyRow[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load API keys");
      setKeys(data.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await readJsonResponse<CreatedKey & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to create API key");

      setCreatedKey(data);
      setName("");
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (revokingId) return;
    setRevokingId(keyId);
    setError(null);
    try {
      const res = await fetch(`/api/account/api-keys/${keyId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await readJsonResponse<{ error?: string }>(res);
        throw new Error(data.error ?? "Failed to revoke key");
      }
      if (createdKey?.key_id === keyId) setCreatedKey(null);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    } finally {
      setRevokingId(null);
    }
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <div>
          <p className="text-sm text-muted-foreground">API keys</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create keys for programmatic access to{" "}
            <code className="text-foreground">/api/v1</code>. Use{" "}
            <code className="text-foreground">Authorization: Bearer &lt;key&gt;</code>.
          </p>
        </div>

        {createdKey ? (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="font-medium text-foreground">Copy your new API key</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the only time the full key is shown. Store it securely.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm">
                {createdKey.secret}
              </code>
              <button
                type="button"
                onClick={() => void copySecret(createdKey.secret)}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted"
              >
                <Copy className="size-4" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="mt-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <form onSubmit={(e) => void handleCreate(e)} className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="api-key-name" className="text-sm font-medium">
              Key name
            </label>
            <input
              id="api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CI deploy, local scripts…"
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition enabled:hover:opacity-90 disabled:opacity-50"
          >
            <KeyRound className="size-4" />
            {creating ? "Creating…" : "Create key"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <div className="mt-8">
          <p className="text-sm font-medium">Active keys</p>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/70 rounded-xl border border-border/70">
              {keys.map((key) => (
                <li
                  key={key.key_id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      <code>{key.key_prefix}…</code>
                      {key.last_used_at
                        ? ` · last used ${new Date(key.last_used_at).toLocaleString()}`
                        : " · never used"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revokingId === key.key_id}
                    onClick={() => void handleRevoke(key.key_id)}
                    className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                    {revokingId === key.key_id ? "Revoking…" : "Revoke"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
