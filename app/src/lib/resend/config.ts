export function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key || null;
}

export function getResendFrom(): string {
  return process.env.RESEND_FROM?.trim() || "Synaro <noreply@synaro.tech>";
}

export function isResendConfigured(): boolean {
  return Boolean(getResendApiKey());
}
