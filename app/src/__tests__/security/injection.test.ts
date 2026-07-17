/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { DASHBOARD_LAYOUT_VERSION } from "@/lib/dashboard/layout-schema";
import { prisma } from "@/lib/prisma";
import dashboardLayoutHandler from "@/pages/api/account/dashboard-layout";
import preferencesHandler from "@/pages/api/account/preferences";
import agentsHandler from "@/pages/api/agents/index";
import projectsHandler from "@/pages/api/projects";
import workspaceWriteHandler from "@/pages/api/projects/[projectId]/workspace-write";
import {
  invokeRoute,
  mockSession,
  SECURITY_PROJECT_A,
  SECURITY_USER_A,
} from "@/testing/security-route-helpers";

const mockGetUserProjectCardsWithRows = jest.fn(() =>
  Promise.resolve({
    rows: [{ id: SECURITY_PROJECT_A, userId: SECURITY_USER_A }],
    cards: [],
  }),
);
const mockGetUserAgentCards = jest.fn(() => Promise.resolve([{ id: "agent-owned" }]));
const mockAllocateUniqueProjectSlug = jest.fn(() => Promise.resolve("safe-slug"));
const mockFetchEnvironmentsForProject = jest.fn(() =>
  Promise.resolve([{ id: "env-1", status: "RUNNING" }]),
);
const mockPickActiveRuntimeEnvironment = jest.fn(
  (rows: { id: string }[]) => rows[0] ?? null,
);
const mockTerminalWriteWorkspaceFile = jest.fn(() => Promise.resolve(undefined));

jest.mock("@/lib/user-project-cards", () => ({
  getUserProjectCardsWithRows: mockGetUserProjectCardsWithRows,
}));

jest.mock("@/lib/user-agents", () => ({
  getUserAgentCards: mockGetUserAgentCards,
}));

jest.mock("@/lib/allocate-project-slug", () => ({
  allocateUniqueProjectSlug: mockAllocateUniqueProjectSlug,
}));

const mockProvisionProjectEnvironment = jest.fn(() =>
  Promise.resolve({ status: "RUNNING", port: 8080 }),
);

jest.mock("@/lib/provision-project-environment", () => ({
  provisionProjectEnvironment: (...args: unknown[]) => mockProvisionProjectEnvironment(...args),
  formatEnvironmentProvisionFailure: jest.fn(() => "provision failed"),
}));

jest.mock("@/lib/environment-service-api", () => ({
  fetchEnvironmentsForProject: mockFetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment: mockPickActiveRuntimeEnvironment,
}));

jest.mock("@/lib/workspace-terminal-fs", () => ({
  terminalWriteWorkspaceFile: mockTerminalWriteWorkspaceFile,
}));

const MALICIOUS_STRINGS = [
  "'; DROP TABLE users--",
  "<script>alert('xss')</script>",
  "${7*7}",
  "safe\0hidden",
];

const SAFE_CLIENT_ERROR_STATUSES = new Set([200, 201, 400, 401, 403, 404, 405, 409, 422, 502]);

function expectNotServerError(statusCode: number) {
  expect(statusCode).not.toBe(500);
  expect(SAFE_CLIENT_ERROR_STATUSES.has(statusCode)).toBe(true);
}

describe("security: injection payloads do not cause 500", () => {
  const projectRow = {
    id: "new-project",
    slug: "safe-slug",
    name: "Safe",
    userId: SECURITY_USER_A,
    environmentStatus: "RUNNING" as const,
    description: null,
    cloneRepositoryUrl: null,
    repositoryLocation: "http://localhost:8080",
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSession(SECURITY_USER_A);

    // restoreMocks: true can clear factory implementations — re-apply every test.
    mockGetUserProjectCardsWithRows.mockResolvedValue({
      rows: [{ id: SECURITY_PROJECT_A, userId: SECURITY_USER_A }],
      cards: [],
    });
    mockGetUserAgentCards.mockResolvedValue([{ id: "agent-owned" }]);
    mockAllocateUniqueProjectSlug.mockResolvedValue("safe-slug");
    mockProvisionProjectEnvironment.mockResolvedValue({ status: "RUNNING", port: 8080 });
    mockFetchEnvironmentsForProject.mockResolvedValue([
      {
        id: "env-1",
        projectId: SECURITY_PROJECT_A,
        status: "RUNNING",
        port: null,
        containerId: null,
      },
    ]);
    mockPickActiveRuntimeEnvironment.mockImplementation(
      (rows: { id: string; status?: string }[] | null | undefined) => {
        if (!Array.isArray(rows) || rows.length === 0) return null;
        return rows.find((r) => r.status === "RUNNING" || r.status === "PROVISIONING") ?? rows[0] ?? null;
      },
    );
    mockTerminalWriteWorkspaceFile.mockResolvedValue(undefined);

    jest.mocked(prisma.project.findFirst).mockResolvedValue({ id: SECURITY_PROJECT_A });
    jest.mocked(prisma.project.create).mockResolvedValue({
      ...projectRow,
      environmentStatus: "PROVISIONING",
      repositoryLocation: null,
    });
    jest.mocked(prisma.project.update).mockResolvedValue(projectRow);
    jest.mocked(prisma.project.findUniqueOrThrow).mockResolvedValue(projectRow);
  });

  it.each(MALICIOUS_STRINGS)("POST /api/projects handles malicious name: %s", async (payload) => {
    const { res } = await invokeRoute(projectsHandler, {
      method: "POST",
      body: { name: payload, dockerImage: "automatic" },
    });

    expectNotServerError(res.statusCode);
  });

  it.each(MALICIOUS_STRINGS)(
    "PUT /api/account/dashboard-layout rejects malicious widget type: %s",
    async (payload) => {
      const { res } = await invokeRoute(dashboardLayoutHandler, {
        method: "PUT",
        body: {
          version: DASHBOARD_LAYOUT_VERSION,
          widgets: [
            {
              id: "w1",
              type: payload,
              x: 0,
              y: 0,
              w: 3,
              h: 2,
              config: { route: "logs" },
            },
          ],
        },
      });

      expectNotServerError(res.statusCode);
      expect(res.statusCode).toBe(400);
    },
  );

  it.each(MALICIOUS_STRINGS)("PATCH /api/account/preferences rejects malicious locale: %s", async (payload) => {
    const { res } = await invokeRoute(preferencesHandler, {
      method: "PATCH",
      body: { preferredLocale: payload },
    });

    expectNotServerError(res.statusCode);
    expect(res.statusCode).toBe(400);
  });

  it.each(MALICIOUS_STRINGS)("POST /api/agents handles malicious body fields: %s", async (payload) => {
    const fetchMock = jest.spyOn(global, "fetch").mockRejectedValue(new Error("upstream down"));

    const { res } = await invokeRoute(agentsHandler, {
      method: "POST",
      body: { name: payload, description: payload },
    });

    fetchMock.mockRestore();
    expectNotServerError(res.statusCode);
  });

  it.each(MALICIOUS_STRINGS)(
    "POST /api/projects/.../workspace-write handles malicious file content: %s",
    async (payload) => {
      const { res } = await invokeRoute(workspaceWriteHandler, {
        method: "POST",
        query: { projectId: SECURITY_PROJECT_A },
        body: { path: "README.md", content: payload },
      });

      expectNotServerError(res.statusCode);
    },
  );

  it("POST /api/projects rejects oversized malicious project name without 500", async () => {
    const { res } = await invokeRoute(projectsHandler, {
      method: "POST",
      body: { name: `${"'; DROP TABLE--".repeat(50)}`, dockerImage: "automatic" },
    });

    expectNotServerError(res.statusCode);
    expect(res.statusCode).toBe(400);
  });
});
