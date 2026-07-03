import { describe, expect, it } from "@jest/globals";

import { DEFAULT_DOC_SLUG } from "@/lib/documentation";
import {
  docPageSeo,
  homePageSeo,
  invitePageSeo,
  mergePageSeo,
  projectShareSeo,
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
});

describe("buildOgImageUrl", () => {
  it("includes cache-bust version param", () => {
    const url = buildOgImageUrl("site");
    expect(url).toContain(`v=${OG_IMAGE_VERSION}`);
    expect(url).toContain("type=site");
    expect(url).toContain("synaro.tech");
  });
});
