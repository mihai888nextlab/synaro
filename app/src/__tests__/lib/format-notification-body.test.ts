import { formatNotificationDescription } from "@/lib/notifications/format-notification-body";

const t = (key: string) =>
  ({
    reasonRateLimited: "rate-limited",
    reasonAuth: "auth",
    reasonTimeout: "timeout",
    reasonCancelled: "cancelled",
    reasonConfig: "config",
    reasonProvider: "provider",
    reasonGenericFailed: "generic",
  })[key] ?? key;

describe("formatNotificationDescription", () => {
  it("maps 429 provider spam to a rate-limit message", () => {
    const raw =
      "LLM error: Error: 429 Your account org-9f80e4e655af4704b7b91c6128c9cc55 / proj-6150816eebef4a2982ba26fdd7e04079 <ak-f9z78apz8yn111fsk3c1> request reached organi";
    expect(formatNotificationDescription(raw, { failed: true, t })).toBe("rate-limited");
  });

  it("strips secrets from short passthrough failures", () => {
    const raw = "Tool failed for org-abc123 on sk_live_secrettoken123";
    const out = formatNotificationDescription(raw, { failed: true, t });
    expect(out).not.toMatch(/org-/);
    expect(out).not.toMatch(/sk_live_/);
  });

  it("returns generic failed when empty", () => {
    expect(formatNotificationDescription("", { failed: true, t })).toBe("generic");
  });
});
