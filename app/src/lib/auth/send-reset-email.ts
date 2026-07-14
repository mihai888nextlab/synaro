import { Resend } from "resend";

import {
  authActionUrl,
  buildSynaroEmailHtml,
  buildSynaroEmailText,
} from "@/lib/email/synaro-email-layout";
import { getResendApiKey, getResendFrom, isResendConfigured } from "@/lib/resend/config";
import { createAuthToken } from "@/lib/auth/tokens";
import { checkAuthEmailRateLimit } from "@/lib/auth/rate-limit";

export type SendPasswordResetEmailResult =
  | { ok: true; devLink?: string }
  | { ok: false; reason: "rate_limited" | "send_failed" | "not_configured" };

export async function sendPasswordResetEmail(
  email: string,
  name?: string | null,
): Promise<SendPasswordResetEmailResult> {
  const cleanEmail = email.toLowerCase().trim();
  if (!checkAuthEmailRateLimit(`reset:${cleanEmail}`)) {
    return { ok: false, reason: "rate_limited" };
  }

  const token = await createAuthToken(cleanEmail, "reset");
  const resetUrl = authActionUrl("/reset-password", token);
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";

  const title = "Reset your password";
  const body = `${greeting}<br /><br />We received a request to reset your Synaro password. Use the button below to choose a new one.`;
  const footerNote =
    "If you did not request this, ignore this email. Your password will not change. This link expires in 1 hour.";

  const html = buildSynaroEmailHtml({
    previewText: "Reset your Synaro password",
    title,
    body,
    buttonLabel: "Reset password",
    buttonHref: resetUrl,
    footerNote,
  });

  const text = buildSynaroEmailText({
    title,
    body: `${greeting}\n\nWe received a request to reset your Synaro password.`,
    buttonLabel: "Reset password",
    buttonHref: resetUrl,
    footerNote,
  });

  if (!isResendConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.info("[auth] RESEND_API_KEY not set — reset link:", resetUrl);
      return { ok: true, devLink: resetUrl };
    }
    return { ok: false, reason: "not_configured" };
  }

  const resend = new Resend(getResendApiKey()!);
  const { error } = await resend.emails.send({
    from: getResendFrom(),
    to: cleanEmail,
    subject: "Reset your Synaro password",
    html,
    text,
  });

  if (error) {
    console.error("[auth] reset email failed:", error);
    if (process.env.NODE_ENV === "development") {
      console.info("[auth] reset fallback link:", resetUrl);
      return { ok: true, devLink: resetUrl };
    }
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true };
}
