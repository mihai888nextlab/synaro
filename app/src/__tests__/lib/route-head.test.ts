import { describe, expect, it } from "@jest/globals";

import { routeHeadProps } from "@/lib/seo/route-head";

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
