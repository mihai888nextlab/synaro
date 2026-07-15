"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import {
  formatAgentApiError,
  type AgentMemoryEntry,
} from "@/lib/agents/agent-types";
import { cn } from "@/lib/utils";

type AgentMemoryPanelProps = {
  agentId: string;
  onCountChange?: (count: number) => void;
};

function memoryTimeAgo(
  iso: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return t("agents.memory.timeAgoSeconds", { count: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t("agents.memory.timeAgoMinutes", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("agents.memory.timeAgoHours", { count: h });
  const d = Math.floor(h / 24);
  return t("agents.memory.timeAgoDays", { count: d });
}

function previewLine(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

type EditorMode =
  | { kind: "add" }
  | { kind: "edit"; key: string; content: string };

export function AgentMemoryPanel({ agentId, onCountChange }: AgentMemoryPanelProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AgentMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [editorKey, setEditorKey] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/memory`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: unknown; message?: string };
        setError(formatAgentApiError(data.error, t("agents.memory.loadFailed"), data.message));
        return;
      }
      const data = (await res.json()) as AgentMemoryEntry[];
      setEntries(data);
      onCountChange?.(data.length);
    } catch {
      setError(t("agents.memory.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [agentId, onCountChange, t]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const openAdd = () => {
    setEditor({ kind: "add" });
    setEditorKey("");
    setEditorContent("");
    setExpandedKey(null);
  };

  const openEdit = (entry: AgentMemoryEntry) => {
    setEditor({ kind: "edit", key: entry.key, content: entry.content });
    setEditorKey(entry.key);
    setEditorContent(entry.content);
    setExpandedKey(entry.key);
  };

  const closeEditor = () => {
    setEditor(null);
    setEditorKey("");
    setEditorContent("");
  };

  const handleSave = async () => {
    const key = editorKey.trim();
    if (!key) {
      setError(t("agents.memory.keyRequired"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/agents/${encodeURIComponent(agentId)}/memory/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editorContent }),
        },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: unknown; message?: string };
        setError(formatAgentApiError(data.error, t("agents.memory.saveFailed"), data.message));
        return;
      }
      closeEditor();
      await loadEntries();
    } catch {
      setError(t("agents.memory.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(t("agents.memory.deleteConfirm", { key }))) return;

    setError("");
    try {
      const res = await fetch(
        `/api/agents/${encodeURIComponent(agentId)}/memory/${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) {
        const data = (await res.json()) as { error?: unknown; message?: string };
        setError(formatAgentApiError(data.error, t("agents.memory.deleteFailed"), data.message));
        return;
      }
      if (expandedKey === key) setExpandedKey(null);
      if (editor?.kind === "edit" && editor.key === key) closeEditor();
      await loadEntries();
    } catch {
      setError(t("agents.memory.deleteFailed"));
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(t("agents.memory.clearAllConfirm"))) return;

    setClearing(true);
    setError("");
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/memory`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json()) as { error?: unknown; message?: string };
        setError(formatAgentApiError(data.error, t("agents.memory.clearAllFailed"), data.message));
        return;
      }
      closeEditor();
      setExpandedKey(null);
      await loadEntries();
    } catch {
      setError(t("agents.memory.clearAllFailed"));
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("agents.memory.hint")}</p>
        <div className="flex shrink-0 items-center gap-2">
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleClearAll()}
              disabled={clearing}
              className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-red-400 disabled:opacity-50"
            >
              {clearing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                t("agents.memory.clearAll")
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-xl border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <Plus className="size-3.5" />
            {t("agents.memory.add")}
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {editor ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
          <p className="mb-3 text-xs font-medium text-foreground">
            {editor.kind === "add" ? t("agents.memory.addTitle") : t("agents.memory.editTitle")}
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("agents.memory.key")}</label>
              <input
                type="text"
                value={editorKey}
                onChange={(e) => setEditorKey(e.target.value)}
                readOnly={editor.kind === "edit"}
                placeholder={t("agents.memory.keyPlaceholder")}
                className={cn(
                  "w-full rounded-xl border border-border/70 bg-card px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-border",
                  editor.kind === "edit" && "cursor-not-allowed opacity-70",
                )}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("agents.memory.content")}
              </label>
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                rows={5}
                placeholder={t("agents.memory.contentPlaceholder")}
                className="w-full resize-y rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-border"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-3 animate-spin" />}
                {t("agents.memory.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entries.length === 0 && !editor ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border border-border/70 bg-card">
            <Brain className="size-6 text-muted-foreground" />
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-medium text-foreground">{t("agents.memory.emptyTitle")}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("agents.memory.emptyBody")}
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="mt-1 flex items-center gap-1.5 rounded-xl border border-border/70 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <Plus className="size-3.5" />
            {t("agents.memory.addFirst")}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const expanded = expandedKey === entry.key;
            return (
              <li
                key={entry.key}
                className="rounded-xl border border-border/70 bg-card transition hover:border-border"
              >
                <button
                  type="button"
                  onClick={() => setExpandedKey(expanded ? null : entry.key)}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <ChevronDown
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-muted-foreground transition",
                      expanded && "rotate-180",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-sm font-medium text-foreground">
                        {entry.key}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground/70">
                        {memoryTimeAgo(entry.updatedAt, t)}
                      </span>
                    </div>
                    {!expanded ? (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {previewLine(entry.content) || t("agents.memory.emptyContent")}
                      </p>
                    ) : null}
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-border/70 px-3 pb-3 pt-2">
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-muted-foreground">
                      {entry.content}
                    </pre>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="size-3" />
                        {t("agents.memory.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(entry.key)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-red-400"
                      >
                        <Trash2 className="size-3" />
                        {t("agents.memory.delete")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
