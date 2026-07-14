import { Resend } from "resend";

import {
  authActionUrl,
  buildSynaroEmailHtml,
  buildSynaroEmailText,
} from "@/lib/email/synaro-email-layout";
import { getResendApiKey, getResendFrom, isResendConfigured } from "@/lib/resend/config";
import { createAuthToken } from "@/lib/auth/tokens";
import { checkAuthEmailRateLimit } from "@/lib/auth/rate-limit";

export type SendVerificationEmailResult =
  | { ok: true; devLink?: string }
  | { ok: false; reason: "rate_limited" | "send_failed" | "not_configured" };

export async function sendVerificationEmail(
  email: string,
  name?: string | null,
): Promise<SendVerificationEmailResult> {
  const cleanEmail = email.toLowerCase().trim();
  if (!checkAuthEmailRateLimit(`verify:${cleanEmail}`)) {
    return { ok: false, reason: "rate_limited" };
  }

  const token = await createAuthToken(cleanEmail, "verify");
  const verifyUrl = authActionUrl("/verify-email", token);
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";

  const title = "Verify your email";
  const body = `${greeting}<br /><br />Confirm your email to sign in to Synaro and use your workspace.`;
  const footerNote =
    "If you did not create a Synaro account, you can ignore this email. This link expires in 24 hours.";

  const html = buildSynaroEmailHtml({
    previewText: "Verify your Synaro email address",
    title,
    body,
    buttonLabel: "Verify email",
    buttonHref: verifyUrl,
    footerNote,
  });

  const text = buildSynaroEmailText({
    title,
    body: `${greeting}\n\nConfirm your email to sign in to Synaro and use your workspace.`,
    buttonLabel: "Verify email",
    buttonHref: verifyUrl,
    footerNote,
  });

  if (!isResendConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.info("[auth] RESEND_API_KEY not set — verification link:", verifyUrl);
      return { ok: true, devLink: verifyUrl };
    }
    return { ok: false, reason: "not_configured" };
  }

  const resend = new Resend(getResendApiKey()!);
  const { error } = await resend.emails.send({
    from: getResendFrom(),
    to: cleanEmail,
    subject: "Verify your Synaro email",
    html,
    text,
  });

  if (error) {
    console.error("[auth] verification email failed:", error);
    if (process.env.NODE_ENV === "development") {
      console.info("[auth] verification fallback link:", verifyUrl);
      return { ok: true, devLink: verifyUrl };
    }
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true };
}
