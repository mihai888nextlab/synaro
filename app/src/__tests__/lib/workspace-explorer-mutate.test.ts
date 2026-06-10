import {
  joinWorkspacePath,
  replaceWorkspacePathBasename,
} from "@/lib/workspace-explorer-mutate";

describe("workspace-explorer-mutate paths", () => {
  it("joins parent and file name", () => {
    expect(joinWorkspacePath("src", "index.ts")).toBe("src/index.ts");
    expect(joinWorkspacePath(null, "README.md")).toBe("README.md");
  });

  it("rejects invalid names", () => {
    expect(joinWorkspacePath("src", "../evil")).toBeNull();
    expect(joinWorkspacePath("src", "a/b")).toBeNull();
  });

  it("replaces basename", () => {
    expect(replaceWorkspacePathBasename("src/foo.ts", "bar.ts")).toBe("src/bar.ts");
    expect(replaceWorkspacePathBasename("README.md", "GUIDE.md")).toBe("GUIDE.md");
  });
});
