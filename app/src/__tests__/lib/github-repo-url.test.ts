import { describe, expect, it } from "@jest/globals";

import {
  defaultProjectNameFromGithubUrl,
  normalizeGithubRepoUrl,
  parseGithubOwnerRepo,
  toGithubAuthenticatedCloneUrl,
  toPublicGitCloneUrl,
} from "@/lib/github-repo-url";

describe("normalizeGithubRepoUrl", () => {
  it("returns null for empty or whitespace-only input", () => {
    expect(normalizeGithubRepoUrl("")).toBeNull();
    expect(normalizeGithubRepoUrl("   ")).toBeNull();
  });

  it("rejects non-GitHub hostnames (security / scope boundary)", () => {
    expect(normalizeGithubRepoUrl("https://gitlab.com/org/repo")).toBeNull();
    expect(normalizeGithubRepoUrl("https://evil.com/github.com/foo/bar")).toBeNull();
  });

  it("accepts github.com and www with https, strips .git and trailing slash", () => {
    expect(normalizeGithubRepoUrl("https://github.com/acme/widget.git")).toBe("https://github.com/acme/widget");
    expect(normalizeGithubRepoUrl("https://www.github.com/acme/widget/")).toBe("https://github.com/acme/widget");
  });

  it("infers https when protocol omitted (user paste scenario)", () => {
    expect(normalizeGithubRepoUrl("github.com/Org/My-Repo")).toBe("https://github.com/Org/My-Repo");
  });

  it("returns null when path has fewer than owner/repo segments", () => {
    expect(normalizeGithubRepoUrl("https://github.com/lonely")).toBeNull();
    expect(normalizeGithubRepoUrl("https://github.com/")).toBeNull();
  });
});

describe("toPublicGitCloneUrl", () => {
  it("builds a .git clone URL from normalized repo URL", () => {
    expect(toPublicGitCloneUrl("https://github.com/acme/widget")).toBe("https://github.com/acme/widget.git");
  });
});

describe("toGithubAuthenticatedCloneUrl", () => {
  it("embeds x-access-token without leaking token in pathname", () => {
    const u = toGithubAuthenticatedCloneUrl("https://github.com/acme/widget", "secret-token");
    const parsed = new URL(u);
    expect(parsed.username).toBe("x-access-token");
    expect(parsed.password).toBe("secret-token");
    expect(parsed.pathname).toBe("/acme/widget.git");
  });
});

describe("parseGithubOwnerRepo", () => {
  it("parses owner and repo from normalized or raw URLs", () => {
    expect(parseGithubOwnerRepo("https://github.com/foo/bar")).toEqual({ owner: "foo", repo: "bar" });
    expect(parseGithubOwnerRepo("https://github.com/foo/bar.git")).toEqual({ owner: "foo", repo: "bar" });
  });

  it("returns null when URL cannot be normalized to GitHub", () => {
    expect(parseGithubOwnerRepo("not-a-url")).toBeNull();
  });
});

describe("defaultProjectNameFromGithubUrl", () => {
  it("uses repo segment as human-readable default name", () => {
    expect(defaultProjectNameFromGithubUrl("https://github.com/acme/super-app")).toBe("super-app");
  });

  it("falls back when URL is malformed", () => {
    expect(defaultProjectNameFromGithubUrl(":::invalid")).toBe("Imported repo");
  });
});
