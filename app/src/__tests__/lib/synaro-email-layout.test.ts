import { describe, expect, it } from "@jest/globals";

import {
  authActionUrl,
  buildSynaroEmailHtml,
  buildSynaroEmailText,
} from "@/lib/email/synaro-email-layout";

describe("synaro email layout", () => {
  const props = {
    previewText: "Verify your Synaro account",
    title: "Verify your email",
    body: "Click the button below to confirm your address.",
    buttonLabel: "Verify email",
    buttonHref: "https://synaro.tech/verify-email?token=abc",
    footerNote: "This link expires in 24 hours.",
  };

  it("builds HTML with title, body, and escaped button href", () => {
    const html = buildSynaroEmailHtml(props);
    expect(html).toContain("Verify your email");
    expect(html).toContain("Click the button below");
    expect(html).toContain("Verify email");
    expect(html).toContain("https://synaro.tech/verify-email?token=abc");
    expect(html).toContain("synaro.tech");
  });

  it("builds plain text with button link and footer", () => {
    const text = buildSynaroEmailText(props);
    expect(text).toContain("Verify your email");
    expect(text).toContain("Verify email: https://synaro.tech/verify-email?token=abc");
    expect(text).toContain("This link expires in 24 hours.");
  });

  it("authActionUrl appends token query param", () => {
    expect(authActionUrl("/verify-email", "tok en")).toContain("token=tok%20en");
  });
});
