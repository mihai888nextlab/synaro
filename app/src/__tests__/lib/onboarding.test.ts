/**
 * @jest-environment jsdom
 */
import { describe, expect, it, beforeEach } from "@jest/globals";

import {
  getEffectiveStepIndex,
  isAppShellPath,
  ONBOARDING_TOUR_STEPS,
  routeMatches,
} from "@/lib/onboarding-tour-steps";
import {
  isOnboardingCompleted,
  markOnboardingCompleted,
  resetOnboardingCompleted,
} from "@/lib/onboarding-storage";

describe("onboarding tour steps", () => {
  it("covers dashboard, projects, workspace, and agents", () => {
    expect(ONBOARDING_TOUR_STEPS.map((s) => s.id)).toEqual([
      "welcome",
      "sidebar",
      "dashboard-edit",
      "dashboard-widgets",
      "nav-projects",
      "projects-new",
      "projects-open",
      "workspace-ai",
      "docker-runtime",
      "nav-agents",
      "agents",
      "agents-run",
      "agents-run-dialog",
      "finish",
    ]);
  });

  it("does not auto-navigate to agents after workspace", () => {
    const agents = ONBOARDING_TOUR_STEPS.find((s) => s.id === "agents");
    expect(agents?.navigateTo).toBeUndefined();
    const navAgents = ONBOARDING_TOUR_STEPS.find((s) => s.id === "nav-agents");
    expect(navAgents?.advanceOnTargetClick).toBe(true);
    expect(navAgents?.navigateTo).toBeUndefined();
  });

  it("skips workspace steps when no project cards exist", () => {
    const openIdx = ONBOARDING_TOUR_STEPS.findIndex((s) => s.id === "projects-open");
    expect(openIdx).toBeGreaterThan(0);
    expect(getEffectiveStepIndex(openIdx)).toBe(
      ONBOARDING_TOUR_STEPS.findIndex((s) => s.id === "nav-agents"),
    );
  });

  it("matches wildcard shell routes for nav-agents", () => {
    expect(routeMatches("/projects/demo", "*")).toBe(true);
    expect(routeMatches("/dashboard", "*")).toBe(true);
    expect(routeMatches("/login", "*")).toBe(false);
  });

  it("detects app shell paths", () => {
    expect(isAppShellPath("/dashboard")).toBe(true);
    expect(isAppShellPath("/projects")).toBe(true);
    expect(isAppShellPath("/projects/[projectSlug]")).toBe(true);
    expect(isAppShellPath("/agents")).toBe(true);
    expect(isAppShellPath("/projects/invite/[token]")).toBe(false);
    expect(isAppShellPath("/")).toBe(false);
    expect(isAppShellPath("/login")).toBe(false);
  });
});

describe("onboarding storage", () => {
  beforeEach(() => {
    resetOnboardingCompleted();
  });

  it("treats v3+ completed records as done", () => {
    expect(isOnboardingCompleted()).toBe(false);
    localStorage.setItem("synaro:onboarding:completed", JSON.stringify({ v: 3, at: 1 }));
    expect(isOnboardingCompleted()).toBe(true);
    resetOnboardingCompleted();
    markOnboardingCompleted();
    expect(isOnboardingCompleted()).toBe(true);
    const raw = JSON.parse(localStorage.getItem("synaro:onboarding:completed")!);
    expect(raw.v).toBe(4);
  });
});
