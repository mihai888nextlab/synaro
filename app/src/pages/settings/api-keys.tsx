import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import type { GetServerSideProps } from "next";

import { requireAuth } from "@/lib/auth-redirect";
import { readJsonResponse } from "@/lib/read-json-response";
import { useTranslation } from "@/components/ui/locale-provider";
import { SettingsLayout } from "@/components/ui/settings/settings-layout";

type ApiKeyRow = {
  key_id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

type CreatedKey = ApiKeyRow & { secret: string };

export default function ApiKeysPage() {
  const { t } = useTranslation();
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
      if (!res.ok) throw new Error(data.error ?? t("apiKeys.loadFailed"));
      setKeys(data.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("apiKeys.loadFailed"));
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
    <SettingsLayout title={t("apiKeys.title")} description={t("apiKeys.description")}>
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        {createdKey ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="font-medium text-foreground">{t("apiKeys.copyNewKeyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("apiKeys.copyNewKeyBody")}
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
                {copied ? t("apiKeys.copied") : t("apiKeys.copy")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="mt-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {t("apiKeys.dismiss")}
            </button>
          </div>
        ) : null}

        <form onSubmit={(e) => void handleCreate(e)} className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="api-key-name" className="text-sm font-medium">
              {t("apiKeys.keyName")}
            </label>
            <input
              id="api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("apiKeys.keyNamePlaceholder")}
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
            {creating ? t("apiKeys.creating") : t("apiKeys.createKey")}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <div className="mt-8">
          <p className="text-sm font-medium">{t("apiKeys.activeKeys")}</p>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : keys.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("apiKeys.noKeysYet")}</p>
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
                        ? ` · ${t("apiKeys.lastUsed", { date: new Date(key.last_used_at).toLocaleString() })}`
                        : ` · ${t("apiKeys.neverUsed")}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revokingId === key.key_id}
                    onClick={() => void handleRevoke(key.key_id)}
                    className="inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                    {revokingId === key.key_id ? t("apiKeys.revoking") : t("apiKeys.revoke")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => requireAuth(ctx);
