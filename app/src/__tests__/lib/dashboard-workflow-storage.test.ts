import {
  clearTerminalScrollback,
  getProjectsNavHref,
  normalizeProjectsPath,
  readLastProjectsPath,
  readProjectTab,
  readTerminalScrollback,
  writeLastProjectsPath,
  writeProjectTab,
  writeTerminalScrollback,
  WORKFLOW_STORAGE_KEYS,
} from "@/lib/dashboard-workflow-storage";

describe("dashboard-workflow-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes projects-area paths", () => {
    expect(normalizeProjectsPath("/projects")).toBe("/projects");
    expect(normalizeProjectsPath("/projects/my-app")).toBe("/projects/my-app");
    expect(normalizeProjectsPath("/projects/my-app/analytics")).toBe(
      "/projects/my-app/analytics",
    );
    expect(normalizeProjectsPath("/projects/invite/abc")).toBeNull();
    expect(normalizeProjectsPath("/dashboard")).toBeNull();
  });

  it("persists full last projects path for sidebar nav", () => {
    expect(readLastProjectsPath()).toBeNull();
    expect(getProjectsNavHref()).toBe("/projects");

    writeLastProjectsPath("/projects");
    expect(readLastProjectsPath()).toBe("/projects");
    expect(getProjectsNavHref()).toBe("/projects");

    writeLastProjectsPath("/projects/my-app/analytics");
    expect(readLastProjectsPath()).toBe("/projects/my-app/analytics");
    expect(getProjectsNavHref()).toBe("/projects/my-app/analytics");
  });

  it("migrates legacy last project slug storage", () => {
    window.localStorage.setItem(WORKFLOW_STORAGE_KEYS.lastProjectSlug, "legacy-app");
    expect(readLastProjectsPath()).toBe("/projects/legacy-app");
    expect(getProjectsNavHref()).toBe("/projects/legacy-app");
    expect(window.localStorage.getItem(WORKFLOW_STORAGE_KEYS.lastProjectSlug)).toBeNull();
  });

  it("persists project tab per slug", () => {
    writeProjectTab("alpha", "terminal");
    expect(readProjectTab("alpha")).toBe("terminal");
    expect(readProjectTab("beta")).toBeNull();
  });

  it("persists terminal scrollback capped by size", () => {
    writeTerminalScrollback("proj-1", "line one\nline two");
    expect(readTerminalScrollback("proj-1")).toBe("line one\nline two");
    clearTerminalScrollback("proj-1");
    expect(readTerminalScrollback("proj-1")).toBeNull();
  });
});
