import { describe, expect, it } from "@jest/globals";

import { humanizeProjectSlug, slugifyProjectName } from "@/lib/project-slug";

describe("humanizeProjectSlug", () => {
  it("returns a safe default for empty or non-string input", () => {
    expect(humanizeProjectSlug("")).toBe("Project");
    expect(humanizeProjectSlug(null as unknown as string)).toBe("Project");
  });

  it("title-cases hyphenated URL segments (breadcrumb-style display)", () => {
    expect(humanizeProjectSlug("peak-athletic")).toBe("Peak Athletic");
    expect(humanizeProjectSlug("ghicesta-b65b")).toBe("Ghicesta B65b");
  });

  it("treats underscores like hyphens for word boundaries", () => {
    expect(humanizeProjectSlug("my_repo_name")).toBe("My Repo Name");
  });

  it("decodes percent-encoded slugs before humanizing (slug is a single token)", () => {
    expect(humanizeProjectSlug("hello%20world")).toBe("Hello world");
  });

  it("returns original slug when decodeURIComponent throws (malformed escape)", () => {
    expect(humanizeProjectSlug("%E0%A4%A")).toBe("%E0%A4%A");
  });
});

describe("slugifyProjectName", () => {
  it("produces URL-safe lowercase slug from a typical product name", () => {
    expect(slugifyProjectName("My Great App!")).toBe("my-great-app");
  });

  it("strips diacritics via NFKD normalization", () => {
    expect(slugifyProjectName("Café Résumé")).toBe("cafe-resume");
  });

  it("collapses repeated punctuation to a single hyphen", () => {
    expect(slugifyProjectName("a---b")).toBe("a-b");
  });

  it("returns fallback when name is only punctuation or spaces", () => {
    expect(slugifyProjectName("   ---  ")).toBe("project");
  });

  it("respects max length cap for long marketing titles", () => {
    const long = "Word ".repeat(30);
    expect(slugifyProjectName(long).length).toBeLessThanOrEqual(48);
  });
});
