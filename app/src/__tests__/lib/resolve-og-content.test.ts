/** @jest-environment node */

import { describe, expect, it } from "@jest/globals";

import { DEFAULT_DOC_SLUG } from "@/lib/documentation";
import { resolveOgContent } from "@/lib/seo/resolve-og-content";

describe("resolveOgContent", () => {
  it("returns site card for type=site", async () => {
    const content = await resolveOgContent("site", {});
    expect(content).toMatchObject({
      badge: "Open",
      accentLabel: "S",
    });
    expect(content?.title.length).toBeGreaterThan(0);
  });

  it("returns null for unknown doc slug", async () => {
    const content = await resolveOgContent("doc", { slug: "__no_such_doc__" });
    expect(content).toBeNull();
  });

  it("returns doc card for a known slug", async () => {
    const content = await resolveOgContent("doc", { slug: DEFAULT_DOC_SLUG });
    expect(content).not.toBeNull();
    expect(content?.badge).toBe("Docs");
  });

  it("returns null for project without slug", async () => {
    const content = await resolveOgContent("project", {});
    expect(content).toBeNull();
  });

  it("returns null for invite without token", async () => {
    const content = await resolveOgContent("invite", {});
    expect(content).toBeNull();
  });
});
