/**
 * Turn raw agent/LLM/tool errors into short, user-facing notification copy.
 * Strips provider account IDs, API key fragments, and nested "Error:" noise.
 */

export type FormatNotificationBodyOptions = {
  failed?: boolean;
  /** i18n lookup, e.g. (key) => t(`notifications.${key}`) */
  t: (key: string) => string;
  maxLength?: number;
};

function stripSecrets(text: string): string {
  return text
    .replace(/\borg-[a-z0-9]+\b/gi, "")
    .replace(/\bproj-[a-z0-9]+\b/gi, "")
    .replace(/<ak-[^>]+>/gi, "")
    .replace(/\bsk_(?:live|test)_[a-z0-9]+\b/gi, "")
    .replace(/\bak-[a-z0-9]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .trim();
}

function unwrapErrorPrefix(text: string): string {
  let out = text.trim();
  // Repeated wrappers: "LLM error: Error: Error: …"
  for (let i = 0; i < 4; i++) {
    const next = out
      .replace(/^(?:LLM|API|Agent|Tool)\s+error:\s*/i, "")
      .replace(/^Error:\s*/i, "")
      .trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function clipAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const cut = slice.lastIndexOf(" ");
  return `${(cut > 40 ? slice.slice(0, cut) : slice).trimEnd()}…`;
}

function matchReasonKey(cleaned: string): string | null {
  const lower = cleaned.toLowerCase();
  if (/\b429\b/.test(lower) || /rate[\s_-]?limit|too many requests|quota/.test(lower)) {
    return "reasonRateLimited";
  }
  if (/\b401\b|\b403\b|unauthorized|forbidden|invalid api key|authentication/.test(lower)) {
    return "reasonAuth";
  }
  if (/\b408\b|timed?\s*out|timeout|deadline exceeded/.test(lower)) {
    return "reasonTimeout";
  }
  if (/cancelled|canceled/.test(lower)) {
    return "reasonCancelled";
  }
  if (/no tools enabled|could not connect to any mcp/.test(lower)) {
    return "reasonConfig";
  }
  if (/\b5\d{2}\b|internal server|service unavailable|bad gateway/.test(lower)) {
    return "reasonProvider";
  }
  if (/^llm\b|openai|anthropic|kimi|moonshot/.test(lower) && /\berror\b/.test(lower)) {
    return "reasonProvider";
  }
  return null;
}

/** User-facing description for inbox + browser notifications. */
export function formatNotificationDescription(
  raw: string | undefined | null,
  { failed = false, t, maxLength = 140 }: FormatNotificationBodyOptions,
): string | undefined {
  const original = raw?.trim();
  if (!original) {
    return failed ? t("reasonGenericFailed") : undefined;
  }

  const cleaned = stripSecrets(unwrapErrorPrefix(original));
  if (!cleaned) {
    return failed ? t("reasonGenericFailed") : undefined;
  }

  if (failed) {
    const reasonKey = matchReasonKey(cleaned) ?? matchReasonKey(original);
    if (reasonKey) return t(reasonKey);

    // Prefer a short human sentence over a truncated opaque blob.
    if (cleaned.length > 180 || /[<>{}]/.test(cleaned) || /\b[a-f0-9]{20,}\b/i.test(cleaned)) {
      return t("reasonGenericFailed");
    }
    return clipAtWord(cleaned, maxLength);
  }

  return clipAtWord(cleaned, maxLength);
}
