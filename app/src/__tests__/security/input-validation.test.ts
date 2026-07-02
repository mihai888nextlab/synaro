/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { DASHBOARD_LAYOUT_VERSION } from "@/lib/dashboard/layout-schema";
import {
  parseDashboardLayout,
  validateDashboardLayout,
} from "@/lib/dashboard/validate-layout";
import { prisma } from "@/lib/prisma";
import dashboardLayoutHandler from "@/pages/api/account/dashboard-layout";
import projectsHandler from "@/pages/api/projects";
import {
  invokeRoute,
  mockSession,
  SECURITY_USER_A,
} from "@/testing/security-route-helpers";

const mockGetUserProjectCardsWithRows = jest.fn(() =>
  Promise.resolve({
    rows: [{ id: "p-owned", userId: SECURITY_USER_A }],
    cards: [],
  }),
);
const mockGetUserAgentCards = jest.fn(() => Promise.resolve([{ id: "a-owned" }]));

jest.mock("@/lib/user-project-cards", () => ({
  getUserProjectCardsWithRows: mockGetUserProjectCardsWithRows,
}));

jest.mock("@/lib/user-agents", () => ({
  getUserAgentCards: mockGetUserAgentCards,
}));

jest.mock("@/lib/allocate-project-slug", () => ({
  allocateUniqueProjectSlug: jest.fn().mockResolvedValue("test-slug"),
}));

describe("security: dashboard layout input validation (lib)", () => {
  const ctx = {
    projectIds: new Set(["p-owned"]),
    agentIds: new Set(["a-owned"]),
  };

  it("parseDashboardLayout rejects non-object payloads", () => {
    expect(parseDashboardLayout(null)).toBeNull();
    expect(parseDashboardLayout("bad")).toBeNull();
    expect(parseDashboardLayout({ version: 999, widgets: [] })).toBeNull();
  });

  it("parseDashboardLayout rejects malformed widgets", () => {
    expect(
      parseDashboardLayout({
        version: DASHBOARD_LAYOUT_VERSION,
        widgets: [{ id: "", type: "page_shortcut", x: 0, y: 0, w: 3, h: 2 }],
      }),
    ).toBeNull();
  });

  it("parseDashboardLayout rejects unknown widget types", () => {
    expect(
      parseDashboardLayout({
        version: DASHBOARD_LAYOUT_VERSION,
        widgets: [{ id: "w1", type: "__proto__", x: 0, y: 0, w: 3, h: 2 }],
      }),
    ).toBeNull();
  });

  it("validateDashboardLayout rejects negative geometry", () => {
    const parsed = parseDashboardLayout({
      version: DASHBOARD_LAYOUT_VERSION,
      widgets: [
        {
          id: "w1",
          type: "page_shortcut",
          x: -1,
          y: 0,
          w: 3,
          h: 2,
          config: { route: "logs" },
        },
      ],
    });
    expect(parsed).not.toBeNull();
    const result = validateDashboardLayout(parsed!, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/geometry/i);
  });

  it("validateDashboardLayout rejects foreign project shortcuts", () => {
    const parsed = parseDashboardLayout({
      version: DASHBOARD_LAYOUT_VERSION,
      widgets: [
        {
          id: "w1",
          type: "project_shortcut",
          x: 0,
          y: 0,
          w: 3,
          h: 2,
          config: { projectId: "foreign-project" },
        },
      ],
    });
    expect(parsed).not.toBeNull();
    const result = validateDashboardLayout(parsed!, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/project you can access/i);
  });

  it("validateDashboardLayout rejects widgets extending past grid columns", () => {
    const parsed = parseDashboardLayout({
      version: DASHBOARD_LAYOUT_VERSION,
      widgets: [
        {
          id: "wide",
          type: "page_shortcut",
          x: 0,
          y: 0,
          w: 13,
          h: 2,
          config: { route: "logs" },
        },
      ],
    });
    expect(parsed).not.toBeNull();
    const result = validateDashboardLayout(parsed!, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/grid columns/i);
  });
});

describe("security: API input validation routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession(SECURITY_USER_A);
  });

  it("PUT /api/account/dashboard-layout rejects empty body", async () => {
    const { res } = await invokeRoute(dashboardLayoutHandler, {
      method: "PUT",
      body: {},
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._getData() as string).error).toMatch(/invalid layout/i);
  });

  it("POST /api/projects rejects empty project name", async () => {
    const createMock = jest.mocked(prisma.project.create);
    createMock.mockClear();

    const { res } = await invokeRoute(projectsHandler, {
      method: "POST",
      body: { name: "   ", dockerImage: "automatic" },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._getData() as string).error).toMatch(/invalid project name/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("POST /api/projects rejects oversized project name", async () => {
    const { res } = await invokeRoute(projectsHandler, {
      method: "POST",
      body: { name: "x".repeat(121), dockerImage: "automatic" },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._getData() as string).error).toMatch(/invalid project name/i);
  });

  it("POST /api/projects rejects invalid GitHub repository URL", async () => {
    const { res } = await invokeRoute(projectsHandler, {
      method: "POST",
      body: {
        name: "From GitHub",
        repositoryUrl: "not-a-valid-url",
        dockerImage: "automatic",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._getData() as string).error).toMatch(/invalid github repository url/i);
  });
});
