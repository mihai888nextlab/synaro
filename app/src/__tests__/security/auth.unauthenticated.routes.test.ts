/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import projectsHandler from "@/pages/api/projects";
import agentsHandler from "@/pages/api/agents/index";
import dashboardLayoutHandler from "@/pages/api/account/dashboard-layout";
import workspaceFilesHandler from "@/pages/api/projects/[projectId]/workspace-files";
import workspaceWriteHandler from "@/pages/api/projects/[projectId]/workspace-write";
import workspaceDownloadHandler from "@/pages/api/projects/[projectId]/workspace-download";
import projectByIdHandler from "@/pages/api/projects/[projectId]";
import importFolderHandler from "@/pages/api/projects/import-folder";
import preferencesHandler from "@/pages/api/account/preferences";
import {
  expectUnauthorized,
  getServerSessionMock,
  invokeRoute,
  mockUnauthenticated,
} from "@/testing/security-route-helpers";

jest.mock("@/lib/user-project-cards", () => ({
  getUserProjectCardsWithRows: jest.fn().mockResolvedValue({ rows: [], cards: [] }),
}));

jest.mock("@/lib/provision-project-environment", () => ({
  provisionProjectEnvironment: jest.fn(),
  uploadWorkspaceTarToEnvironment: jest.fn(),
  formatEnvironmentProvisionFailure: jest.fn(),
  environmentServiceBaseUrl: jest.fn(() => "http://localhost:3004"),
}));

describe("security: unauthenticated routes return 401", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnauthenticated();
  });

  it("GET /api/projects", async () => {
    await expectUnauthorized(projectsHandler, { method: "GET" });
  });

  it("POST /api/projects", async () => {
    await expectUnauthorized(projectsHandler, {
      method: "POST",
      body: { name: "Test project" },
    });
  });

  it("GET /api/agents", async () => {
    await expectUnauthorized(agentsHandler, { method: "GET" });
  });

  it("POST /api/agents", async () => {
    await expectUnauthorized(agentsHandler, {
      method: "POST",
      body: { name: "Agent" },
    });
  });

  it("GET /api/account/dashboard-layout", async () => {
    await expectUnauthorized(dashboardLayoutHandler, { method: "GET" });
  });

  it("PUT /api/account/dashboard-layout", async () => {
    await expectUnauthorized(dashboardLayoutHandler, {
      method: "PUT",
      body: { version: 1, widgets: [] },
    });
  });

  it("GET /api/projects/[projectId]/workspace-files", async () => {
    await expectUnauthorized(workspaceFilesHandler, {
      method: "GET",
      query: { projectId: "p1" },
    });
  });

  it("POST /api/projects/[projectId]/workspace-write", async () => {
    await expectUnauthorized(workspaceWriteHandler, {
      method: "POST",
      query: { projectId: "p1" },
      body: { path: "README.md", content: "hello" },
    });
  });

  it("GET /api/projects/[projectId]/workspace-download", async () => {
    await expectUnauthorized(workspaceDownloadHandler, {
      method: "GET",
      query: { projectId: "p1" },
    });
  });

  it("DELETE /api/projects/[projectId]", async () => {
    await expectUnauthorized(projectByIdHandler, {
      method: "DELETE",
      query: { projectId: "p1" },
    });
  });

  it("POST /api/projects/import-folder", async () => {
    await expectUnauthorized(importFolderHandler, { method: "POST" });
  });

  it("GET /api/account/preferences", async () => {
    await expectUnauthorized(preferencesHandler, { method: "GET" });
  });

  it("does not proceed to handler logic when session is missing", async () => {
    const { res } = await invokeRoute(projectsHandler, { method: "GET" });
    expect(res.statusCode).toBe(401);
    expect(getServerSessionMock).toHaveBeenCalled();
  });
});
