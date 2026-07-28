import { Resend } from "resend";

import { renderArtifactsForEmail } from "@/lib/agents/render-artifacts-for-email";
import {
  buildSynaroEmailHtml,
  buildSynaroEmailText,
} from "@/lib/email/synaro-email-layout";
import { absoluteUrl } from "@/lib/seo/site-metadata";
import { getResendApiKey, getResendFrom, isResendConfigured } from "@/lib/resend/config";
import { prisma } from "@/lib/prisma";

const MAX_OUTPUT_CHARS = 8_000;

export type AgentRunEmailPayload = {
  runId: string;
  agentId: string;
  userId: string;
  agentName: string;
  status: "DONE" | "FAILED";
  trigger: string;
  output: string | null;
  artifacts?: unknown;
  finishedAt: string;
};

export type SendAgentRunEmailResult =
  | { ok: true; skipped?: false; devLogged?: boolean }
  | { ok: true; skipped: true; reason: "no_user" | "no_email" }
  | { ok: false; reason: "send_failed" | "not_configured" };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatOutputForEmail(output: string | null): { html: string; text: string } {
  const raw = output?.trim() || "";
  if (!raw) {
    return { html: "", text: "" };
  }

  const truncated = raw.length > MAX_OUTPUT_CHARS;
  const body = truncated ? `${raw.slice(0, MAX_OUTPUT_CHARS).trimEnd()}…` : raw;
  const note = truncated
    ? `<p style="margin:12px 0 0;font-size:12px;color:#71717a;">Summary truncated. Open the run in Synaro for the full result.</p>`
    : "";
  const textNote = truncated
    ? "\n\n(Summary truncated. Open the run in Synaro for the full result.)"
    : "";

  return {
    html: `<p style="margin:16px 0 0;font-size:12px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.06em;">Summary</p>
      <pre style="margin:8px 0 0;padding:16px;background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.6;color:#e4e4e7;white-space:pre-wrap;word-break:break-word;overflow-x:auto;">${escapeHtml(body)}</pre>${note}`,
    text: `Summary\n${body}${textNote}`,
  };
}

function formatFinishedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export async function sendAgentRunCompleteEmail(
  payload: AgentRunEmailPayload,
): Promise<SendAgentRunEmailResult> {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true, name: true },
  });

  if (!user) return { ok: true, skipped: true, reason: "no_user" };
  const email = user.email.trim().toLowerCase();
  if (!email) return { ok: true, skipped: true, reason: "no_email" };

  const runUrl = absoluteUrl(
    `/agents/${encodeURIComponent(payload.agentId)}/runs/${encodeURIComponent(payload.runId)}`,
  );
  const statusLabel = payload.status === "DONE" ? "completed" : "failed";
  const title =
    payload.status === "DONE"
      ? `${payload.agentName} run completed`
      : `${payload.agentName} run failed`;
  const greeting = user.name?.trim() ? `Hi ${user.name.trim()},` : "Hi,";
  const meta = `Agent: <strong style="color:#ffffff;">${escapeHtml(payload.agentName)}</strong><br />Status: ${escapeHtml(statusLabel)}<br />Trigger: ${escapeHtml(payload.trigger)}<br />Finished: ${escapeHtml(formatFinishedAt(payload.finishedAt))}`;
  const artifactsBlock = renderArtifactsForEmail(payload.artifacts);
  const outputBlock = formatOutputForEmail(payload.output);
  const hasArtifacts = Boolean(artifactsBlock.html);
  const emptyNote =
    !hasArtifacts && !outputBlock.html
      ? `<p style="margin:16px 0 0;font-size:13px;color:#71717a;font-style:italic;">No artifacts or summary for this run.</p>`
      : "";

  const bodyHtml = `${greeting}<br /><br />${meta}${artifactsBlock.html}${outputBlock.html}${emptyNote}`;
  const bodyText = [
    greeting,
    "",
    `Agent: ${payload.agentName}`,
    `Status: ${statusLabel}`,
    `Trigger: ${payload.trigger}`,
    `Finished: ${formatFinishedAt(payload.finishedAt)}`,
    artifactsBlock.text,
    outputBlock.text || (!hasArtifacts ? "\nNo artifacts or summary for this run." : ""),
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  const subject = `[Synaro] ${title}`;
  const html = buildSynaroEmailHtml({
    previewText: title,
    title,
    body: bodyHtml,
    buttonLabel: "View run",
    buttonHref: runUrl,
    footerNote: "You received this because email notifications are enabled for this agent.",
    contentMaxWidthPx: hasArtifacts ? 600 : 480,
  });
  const text = buildSynaroEmailText({
    title,
    body: bodyText,
    buttonLabel: "View run",
    buttonHref: runUrl,
    footerNote: "You received this because email notifications are enabled for this agent.",
  });

  if (!isResendConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.info("[agents] RESEND_API_KEY not set — run complete email:", {
        to: email,
        subject,
        runUrl,
        hasArtifacts,
      });
      console.info(bodyText);
      return { ok: true, devLogged: true };
    }
    return { ok: false, reason: "not_configured" };
  }

  const resend = new Resend(getResendApiKey()!);
  const { error } = await resend.emails.send({
    from: getResendFrom(),
    to: email,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("[agents] run complete email failed:", error);
    if (process.env.NODE_ENV === "development") {
      console.info("[agents] run complete email fallback:", { to: email, subject, runUrl });
      return { ok: true, devLogged: true };
    }
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true };
}
