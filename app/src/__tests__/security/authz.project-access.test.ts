/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { prisma } from "@/lib/prisma";
import {
  whereProjectByIdForUser,
  whereProjectVisibleToUser,
} from "@/lib/project-access";
import workspaceFilesHandler from "@/pages/api/projects/[projectId]/workspace-files";
import workspaceWriteHandler from "@/pages/api/projects/[projectId]/workspace-write";
import workspaceDownloadHandler from "@/pages/api/projects/[projectId]/workspace-download";
import projectByIdHandler from "@/pages/api/projects/[projectId]";
import {
  SECURITY_PROJECT_A,
  SECURITY_USER_A,
  SECURITY_USER_B,
  expectProjectNotFound,
  invokeRoute,
  mockSession,
} from "@/testing/security-route-helpers";

jest.mock("@/lib/environment-service-api", () => ({
  fetchEnvironmentsForProject: jest.fn().mockResolvedValue([]),
  pickActiveRuntimeEnvironment: jest.fn(),
  remoteListWorkspaceFiles: jest.fn(),
  destroyAllRemoteEnvironmentsForProject: jest.fn().mockResolvedValue(undefined),
}));

const findFirstMock = jest.mocked(prisma.project.findFirst);

describe("security: project access filters", () => {
  it("whereProjectVisibleToUser scopes to owner or member", () => {
    expect(whereProjectVisibleToUser(SECURITY_USER_A)).toEqual({
      OR: [{ userId: SECURITY_USER_A }, { members: { some: { userId: SECURITY_USER_A } } }],
    });
  });

  it("whereProjectByIdForUser binds project id to the same visibility rule", () => {
    expect(whereProjectByIdForUser(SECURITY_PROJECT_A, SECURITY_USER_B)).toEqual({
      id: SECURITY_PROJECT_A,
      OR: [{ userId: SECURITY_USER_B }, { members: { some: { userId: SECURITY_USER_B } } }],
    });
  });
});

describe("security: IDOR — foreign project returns 404", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/projects/[projectId]/workspace-files", async () => {
    await expectProjectNotFound(workspaceFilesHandler, {
      method: "GET",
      query: { projectId: SECURITY_PROJECT_A },
    });
  });

  it("POST /api/projects/[projectId]/workspace-write", async () => {
    await expectProjectNotFound(workspaceWriteHandler, {
      method: "POST",
      query: { projectId: SECURITY_PROJECT_A },
      body: { path: "src/index.ts", content: "x" },
    });
  });

  it("GET /api/projects/[projectId]/workspace-download", async () => {
    await expectProjectNotFound(workspaceDownloadHandler, {
      method: "GET",
      query: { projectId: SECURITY_PROJECT_A },
    });
  });

  it("DELETE /api/projects/[projectId] rejects non-owner", async () => {
    mockSession(SECURITY_USER_B);
    findFirstMock.mockResolvedValue(null);

    const { res } = await invokeRoute(projectByIdHandler, {
      method: "DELETE",
      query: { projectId: SECURITY_PROJECT_A },
    });

    expect(res.statusCode).toBe(404);
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SECURITY_PROJECT_A, userId: SECURITY_USER_B },
      }),
    );
  });

  it("DELETE /api/projects/[projectId] uses owner-only guard (not collaborator)", async () => {
    mockSession(SECURITY_USER_A);
    findFirstMock.mockResolvedValue({ id: SECURITY_PROJECT_A });

    const { res } = await invokeRoute(projectByIdHandler, {
      method: "DELETE",
      query: { projectId: SECURITY_PROJECT_A },
    });

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SECURITY_PROJECT_A, userId: SECURITY_USER_A },
      }),
    );
    expect(res.statusCode).toBe(204);
  });
});
