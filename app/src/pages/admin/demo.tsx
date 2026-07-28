import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import * as React from "react";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

type DemoProject = { id: string; name: string; slug: string; environmentStatus: string };
type DemoAccount = { id: string; name: string; email: string; projects: DemoProject[] };
type SourceProject = { id: string; title: string };

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const userId = session?.user?.id;
  let email = session?.user?.email ?? null;
  if (userId && !email) {
    email = (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email ?? null;
  }
  if (!userId || !isAdminEmail(email)) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
};

const badge: Record<string, string> = {
  RUNNING: "bg-green-500/15 text-green-400",
  PROVISIONING: "bg-amber-500/15 text-amber-400",
  STOPPED: "bg-zinc-500/15 text-zinc-400",
  INACTIVE: "bg-zinc-500/15 text-zinc-400",
  ERROR: "bg-red-500/15 text-red-400",
};

export default function DemoAdminPage() {
  const [accounts, setAccounts] = React.useState<DemoAccount[]>([]);
  const [sources, setSources] = React.useState<SourceProject[]>([]);
  const [sourceId, setSourceId] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [creds, setCreds] = React.useState<{ email: string; password: string }[]>([]);

  const loadAccounts = React.useCallback(async () => {
    const res = await fetch("/api/admin/demo");
    if (res.ok) setAccounts((await res.json()).accounts ?? []);
  }, []);

  React.useEffect(() => {
    void loadAccounts();
    void (async () => {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const list = ((await res.json()).projects ?? []) as SourceProject[];
        setSources(list);
        if (list[0]) setSourceId(list[0].id);
      }
    })();
  }, [loadAccounts]);

  async function createAccount() {
    setBusy("create");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setCreds((c) => [{ email: data.user.email, password: data.password }, ...c]);
      setNewName("");
      await loadAccounts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function cloneInto(accountId: string) {
    if (!sourceId) {
      setMessage("Pick a source project first.");
      return;
    }
    setBusy(`clone-${accountId}`);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/demo/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceProjectId: sourceId, targetUserId: accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Clone failed");
      const counts = `copied ${data.chatCloned ?? 0} chat message(s), ${data.agentsCloned ?? 0} agent(s)`;
      const warn = Array.isArray(data.warnings) && data.warnings.length ? ` — warnings: ${data.warnings.join("; ")}` : "";
      setMessage(`Cloned "${data.name}" — ${counts}${warn}`);
      await loadAccounts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function cloneAgents(accountId: string) {
    setBusy(`agents-${accountId}`);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/demo/clone-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Clone agents failed");
      setMessage(`Cloned ${data.clonedAgents ?? 0} agent(s) (${data.clonedRuns ?? 0} run(s)) into this account.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount(accountId: string, email: string) {
    if (!window.confirm(`Delete demo account ${email} and all its projects, containers, chat and agents? This cannot be undone.`)) {
      return;
    }
    setBusy(`del-${accountId}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/demo/${encodeURIComponent(accountId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Delete failed (${res.status})`);
      }
      setMessage(`Deleted ${email}.`);
      await loadAccounts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleEnv(projectId: string, action: "start" | "stop") {
    setBusy(`env-${projectId}`);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/demo/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await loadAccounts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Demo accounts</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Create jury accounts, then clone one of your projects into each (own container, same files, same chat, same agents). Start their containers before the demo.
          </p>
        </div>

        {message ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>
        ) : null}

        {creds.length ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
            <p className="mb-2 font-medium text-green-300">New credentials (copy now — password is shown once):</p>
            <ul className="space-y-1 font-mono text-xs text-green-200">
              {creds.map((c) => (
                <li key={c.email}>{c.email} — {c.password}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Create account */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-medium">Create demo account</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Display name (e.g. Jury 1)"
              className="h-9 w-56 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-500"
            />
            <button
              onClick={() => void createAccount()}
              disabled={busy === "create"}
              className="h-9 rounded-lg bg-white px-4 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {busy === "create" ? "Creating…" : "Create"}
            </button>
            <span className="text-xs text-zinc-500">Email + password auto-generated.</span>
          </div>
        </div>

        {/* Source project picker */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-medium">Project to clone into accounts</h2>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="mt-3 h-9 w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-500"
          >
            {sources.length === 0 ? <option value="">No projects found</option> : null}
            {sources.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* Accounts */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">Accounts ({accounts.length})</h2>
          {accounts.length === 0 ? <p className="text-sm text-zinc-500">No demo accounts yet.</p> : null}
          {accounts.map((acc) => (
            <div key={acc.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{acc.name}</p>
                  <p className="font-mono text-xs text-zinc-500">{acc.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void cloneInto(acc.id)}
                    disabled={busy === `clone-${acc.id}` || !sourceId}
                    className="h-8 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {busy === `clone-${acc.id}` ? "Cloning…" : "Clone selected project here"}
                  </button>
                  <button
                    onClick={() => void cloneAgents(acc.id)}
                    disabled={busy === `agents-${acc.id}`}
                    className="h-8 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {busy === `agents-${acc.id}` ? "Cloning…" : "Clone agents"}
                  </button>
                  <button
                    onClick={() => void deleteAccount(acc.id, acc.email)}
                    disabled={busy === `del-${acc.id}`}
                    className="h-8 rounded-lg border border-red-500/40 px-3 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {busy === `del-${acc.id}` ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>

              {acc.projects.length ? (
                <ul className="mt-3 space-y-2">
                  {acc.projects.map((p) => {
                    const running = p.environmentStatus === "RUNNING" || p.environmentStatus === "PROVISIONING";
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                        <span className="truncate">{p.name}</span>
                        <span className="font-mono text-xs text-zinc-500">/{p.slug}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[0.7rem] ${badge[p.environmentStatus] ?? badge.INACTIVE}`}>
                          {p.environmentStatus}
                        </span>
                        <span className="ml-auto flex gap-1.5">
                          <button
                            onClick={() => void toggleEnv(p.id, "start")}
                            disabled={busy === `env-${p.id}` || running}
                            className="h-7 rounded-lg border border-zinc-700 px-2.5 text-xs text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                          >
                            {busy === `env-${p.id}` ? "…" : "Start"}
                          </button>
                          <button
                            onClick={() => void toggleEnv(p.id, "stop")}
                            disabled={busy === `env-${p.id}` || !running}
                            className="h-7 rounded-lg border border-zinc-700 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                          >
                            Stop
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-zinc-600">No projects yet — clone one in.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
