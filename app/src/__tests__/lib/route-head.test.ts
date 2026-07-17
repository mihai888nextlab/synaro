import { describe, expect, it } from "@jest/globals";

import { isPrivateAppRoute, routeHeadProps } from "@/lib/seo/route-head";

describe("isPrivateAppRoute", () => {
  it("includes dashboard shell routes", () => {
    expect(isPrivateAppRoute("/dashboard")).toBe(true);
    expect(isPrivateAppRoute("/projects")).toBe(true);
    expect(isPrivateAppRoute("/projects/[projectSlug]")).toBe(true);
    expect(isPrivateAppRoute("/agents")).toBe(true);
    expect(isPrivateAppRoute("/agents/[agentId]/runs/[runId]")).toBe(true);
    expect(isPrivateAppRoute("/logs")).toBe(true);
    expect(isPrivateAppRoute("/settings")).toBe(true);
    expect(isPrivateAppRoute("/settings/api-keys")).toBe(true);
  });

  it("excludes marketing, auth, docs, and public share routes", () => {
    expect(isPrivateAppRoute("/")).toBe(false);
    expect(isPrivateAppRoute("/features")).toBe(false);
    expect(isPrivateAppRoute("/pricing")).toBe(false);
    expect(isPrivateAppRoute("/about")).toBe(false);
    expect(isPrivateAppRoute("/contact")).toBe(false);
    expect(isPrivateAppRoute("/login")).toBe(false);
    expect(isPrivateAppRoute("/signup")).toBe(false);
    expect(isPrivateAppRoute("/forgot-password")).toBe(false);
    expect(isPrivateAppRoute("/documentation")).toBe(false);
    expect(isPrivateAppRoute("/documentation/[slug]")).toBe(false);
    expect(isPrivateAppRoute("/projects/invite/[token]")).toBe(false);
    expect(isPrivateAppRoute("/p/[projectSlug]")).toBe(false);
    expect(isPrivateAppRoute("/a/[agentId]")).toBe(false);
  });
});

describe("routeHeadProps", () => {
  it("maps home route to marketing seo", () => {
    const props = routeHeadProps("/", {}, "/");
    expect(props.title).toMatch(/Build and run software/i);
    expect(props.ogType).toBe("site");
  });

  it("maps documentation slug to doc OG params", () => {
    const props = routeHeadProps("/documentation/[slug]", { slug: "getting-started" }, "/documentation/getting-started");
    expect(props.ogType).toBe("doc");
    expect(props.ogParams).toEqual({ slug: "getting-started" });
    expect(props.title).toBeTruthy();
    expect(props.noIndex).toBeUndefined();
  });

  it("maps invite token to invite OG params", () => {
    const props = routeHeadProps(
      "/projects/invite/[token]",
      { token: "abc123" },
      "/projects/invite/abc123",
    );
    expect(props.ogType).toBe("invite");
    expect(props.ogParams).toEqual({ token: "abc123" });
  });

  it("marks dashboard routes as noindex", () => {
    const props = routeHeadProps("/dashboard", {}, "/dashboard");
    expect(props.noIndex).toBe(true);
  });

  it("marks agent run detail subpaths as noindex", () => {
    const props = routeHeadProps(
      "/agents/[agentId]/runs/[runId]",
      { agentId: "agent-1", runId: "run-1" },
      "/agents/agent-1/runs/run-1",
    );
    expect(props.noIndex).toBe(true);
    expect(props.path).toBe("/agents/agent-1/runs/run-1");
  });

  it("maps forgot-password route to reset seo", () => {
    const props = routeHeadProps("/forgot-password", {}, "/forgot-password");
    expect(props.path).toBe("/forgot-password");
    expect(props.title).toBe("Reset password");
    expect(props.noIndex).toBe(true);
  });

  it("maps project slug for OG image while keeping noindex", () => {
    const props = routeHeadProps(
      "/projects/[projectSlug]",
      { projectSlug: "my-app" },
      "/projects/my-app",
    );
    expect(props.ogType).toBe("project");
    expect(props.ogParams).toEqual({ slug: "my-app" });
    expect(props.noIndex).toBe(true);
  });
});
