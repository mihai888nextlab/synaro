import {
  clearTerminalScrollback,
  clampPreviewPanelWidthPx,
  defaultPreviewPanelWidthPx,
  getProjectsNavHref,
  normalizeProjectsPath,
  PREVIEW_PANEL_MIN_PX,
  readLastProjectsPath,
  readPreviewPanelWidthPx,
  readProjectTab,
  readTerminalScrollback,
  writeLastProjectsPath,
  writePreviewPanelWidthPx,
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
    expect(normalizeProjectsPath("/projects/my-app/analytics")).toBe("/projects/my-app");
    expect(normalizeProjectsPath("/projects/invite/abc")).toBeNull();
    expect(normalizeProjectsPath("/dashboard")).toBeNull();
  });

  it("persists full last projects path for sidebar nav", () => {
    expect(readLastProjectsPath()).toBeNull();
    expect(getProjectsNavHref()).toBe("/projects");

    writeLastProjectsPath("/projects");
    expect(readLastProjectsPath()).toBe("/projects");
    expect(getProjectsNavHref()).toBe("/projects");

    writeLastProjectsPath("/projects/my-app");
    expect(readLastProjectsPath()).toBe("/projects/my-app");
    expect(getProjectsNavHref()).toBe("/projects/my-app");

    writeLastProjectsPath("/projects/my-app/analytics");
    expect(readLastProjectsPath()).toBe("/projects/my-app");
    expect(getProjectsNavHref()).toBe("/projects/my-app");
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

  it("clamps and persists preview panel width", () => {
    expect(clampPreviewPanelWidthPx(100, 1000)).toBe(PREVIEW_PANEL_MIN_PX);
    expect(clampPreviewPanelWidthPx(900, 1000)).toBe(700);
    expect(defaultPreviewPanelWidthPx(1000)).toBe(380);

    expect(readPreviewPanelWidthPx("proj-1")).toBeNull();
    writePreviewPanelWidthPx("proj-1", 420.6);
    expect(readPreviewPanelWidthPx("proj-1")).toBe(421);
    expect(readPreviewPanelWidthPx("proj-2")).toBeNull();
  });
});
