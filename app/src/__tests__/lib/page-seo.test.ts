import { describe, expect, it } from "@jest/globals";

import { DEFAULT_DOC_SLUG } from "@/lib/documentation";
import {
  docPageSeo,
  featuresPageSeo,
  forgotPasswordPageSeo,
  homePageSeo,
  invitePageSeo,
  mergePageSeo,
  projectShareSeo,
  agentShareSeo,
} from "@/lib/seo/page-seo";
import { routeHeadProps } from "@/lib/seo/route-head";
import { OG_IMAGE_VERSION, buildOgImageUrl } from "@/lib/seo/og-url";

describe("mergePageSeo", () => {
  it("merges title and og params from page props over route defaults", () => {
    const merged = mergePageSeo(
      routeHeadProps("/projects/invite/[token]", { token: "abc" }, "/projects/invite/abc"),
      invitePageSeo("abc", "Acme App"),
    );

    expect(merged.title).toBe("Join Acme App");
    expect(merged.ogType).toBe("invite");
    expect(merged.ogParams).toEqual({ token: "abc" });
  });

  it("returns base when override is absent", () => {
    const base = homePageSeo();
    expect(mergePageSeo(base, null)).toEqual(base);
  });
});

describe("page seo builders", () => {
  it("docPageSeo uses documentation title and slug", () => {
    const seo = docPageSeo(DEFAULT_DOC_SLUG);
    expect(seo.title).toBeTruthy();
    expect(seo.ogType).toBe("doc");
    expect(seo.ogParams?.slug).toBe(DEFAULT_DOC_SLUG);
    expect(seo.path).toBe("/documentation");
  });

  it("projectShareSeo points at public share path", () => {
    const seo = projectShareSeo("my-app", "My App", "A demo workspace");
    expect(seo.path).toBe("/p/my-app");
    expect(seo.ogType).toBe("project");
    expect(seo.ogParams).toEqual({ slug: "my-app" });
    expect(seo.title).toBe("My App");
  });

  it("featuresPageSeo points at features path", () => {
    const seo = featuresPageSeo();
    expect(seo.path).toBe("/features");
    expect(seo.ogType).toBe("site");
    expect(seo.title).toBe("Features");
  });

  it("forgotPasswordPageSeo points at forgot-password path", () => {
    const seo = forgotPasswordPageSeo();
    expect(seo.path).toBe("/forgot-password");
    expect(seo.noIndex).toBe(true);
  });

  it("agentShareSeo points at public agent path", () => {
    const seo = agentShareSeo("agent-123", "Research Bot", "Finds papers");
    expect(seo.path).toBe("/a/agent-123");
    expect(seo.ogType).toBe("agent");
    expect(seo.ogParams).toEqual({ id: "agent-123" });
    expect(seo.title).toBe("Research Bot");
    expect(seo.description).toBe("Finds papers");
  });
});

describe("buildOgImageUrl", () => {
  it("includes cache-bust version param", () => {
    const url = buildOgImageUrl("site");
    expect(url).toContain(`v=${OG_IMAGE_VERSION}`);
    expect(url).toContain("type=site");
    expect(url).toContain("synaro.tech");
  });
});
