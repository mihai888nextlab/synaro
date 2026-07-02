/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { sanitizeUploadRelativePath } from "@/lib/import-folder-paths";
import {
  sanitizeWorkspaceRelativePath,
  terminalWriteWorkspaceFile,
} from "@/lib/workspace-terminal-fs";
import { joinWorkspacePath } from "@/lib/workspace-explorer-mutate";
import { prisma } from "@/lib/prisma";
import workspaceSelectionHandler from "@/pages/api/projects/[projectId]/workspace-selection";
import {
  invokeRoute,
  mockSession,
  SECURITY_PROJECT_A,
  SECURITY_USER_A,
} from "@/testing/security-route-helpers";

const findFirstMock = jest.mocked(prisma.project.findFirst);

describe("security: path traversal sanitizers (lib)", () => {
  it("sanitizeUploadRelativePath blocks classic traversal", () => {
    expect(sanitizeUploadRelativePath("../etc/passwd")).toBeNull();
    expect(sanitizeUploadRelativePath("foo/../../etc/passwd")).toBeNull();
    expect(sanitizeUploadRelativePath("..\\windows\\system32")).toBeNull();
  });

  it("sanitizeUploadRelativePath blocks nul bytes and empty segments", () => {
    expect(sanitizeUploadRelativePath("safe\0name.txt")).toBeNull();
    expect(sanitizeUploadRelativePath("")).toBeNull();
  });

  it("sanitizeUploadRelativePath strips leading slashes on otherwise safe paths", () => {
    expect(sanitizeUploadRelativePath("/etc/passwd")).toBe("etc/passwd");
  });

  it("sanitizeUploadRelativePath allows normal nested paths", () => {
    expect(sanitizeUploadRelativePath("src/index.ts")).toBe("src/index.ts");
    expect(sanitizeUploadRelativePath("./src/index.ts")).toBe("src/index.ts");
  });

  it("sanitizeWorkspaceRelativePath blocks traversal and absolute paths", () => {
    expect(sanitizeWorkspaceRelativePath("../etc/passwd")).toBeNull();
    expect(sanitizeWorkspaceRelativePath("/etc/passwd")).toBeNull();
    expect(sanitizeWorkspaceRelativePath("src/../../secret")).toBeNull();
  });

  it("sanitizeWorkspaceRelativePath rejects unexpected characters", () => {
    expect(sanitizeWorkspaceRelativePath("src/$(whoami).sh")).toBeNull();
    expect(sanitizeWorkspaceRelativePath("src/file name.ts")).toBeNull();
  });

  it("joinWorkspacePath rejects traversal in folder names", () => {
    expect(joinWorkspacePath("src", "../evil.ts")).toBeNull();
    expect(joinWorkspacePath("../src", "file.ts")).toBeNull();
  });

  it("terminalWriteWorkspaceFile rejects traversal before remote exec", async () => {
    await expect(
      terminalWriteWorkspaceFile("env-1", "../etc/passwd", "owned"),
    ).rejects.toThrow("Invalid path");
  });
});

describe("security: path traversal on workspace routes", () => {
  beforeEach(() => {
    mockSession(SECURITY_USER_A);
    findFirstMock.mockResolvedValue({ id: SECURITY_PROJECT_A, cloneRepositoryUrl: null });
  });

  it("GET /workspace-selection rejects empty path", async () => {
    const { res } = await invokeRoute(workspaceSelectionHandler, {
      method: "GET",
      query: { projectId: SECURITY_PROJECT_A, path: "   " },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res._getData() as string).error).toMatch(/invalid project id or path/i);
  });

  it("GET /workspace-selection with traversal-like path does not return 401", async () => {
    const { res } = await invokeRoute(workspaceSelectionHandler, {
      method: "GET",
      query: { projectId: SECURITY_PROJECT_A, path: "../../../etc/passwd" },
    });

    expect(res.statusCode).not.toBe(401);
  });
});
