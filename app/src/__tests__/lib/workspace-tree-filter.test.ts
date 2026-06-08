import {
  filterWorkspaceTreePaths,
  isWorkspaceTreePathVisible,
} from "@/lib/workspace-tree-filter";

describe("workspace tree path filter", () => {
  it("keeps normal app source files", () => {
    expect(isWorkspaceTreePathVisible("src/index.ts")).toBe(true);
    expect(isWorkspaceTreePathVisible("package.json")).toBe(true);
    expect(isWorkspaceTreePathVisible("README.md")).toBe(true);
  });

  it("drops caches, dependencies, and hidden tooling paths", () => {
    expect(isWorkspaceTreePathVisible("node_modules/foo/index.js")).toBe(false);
    expect(isWorkspaceTreePathVisible(".npm/_cacache/foo")).toBe(false);
    expect(isWorkspaceTreePathVisible("src/.cache/x")).toBe(false);
    expect(isWorkspaceTreePathVisible(".next/server.js")).toBe(false);
    expect(isWorkspaceTreePathVisible(".env.local")).toBe(false);
    expect(isWorkspaceTreePathVisible("package-lock.json")).toBe(false);
  });

  it("filters arrays", () => {
    expect(
      filterWorkspaceTreePaths(["src/a.ts", "node_modules/b.js", ".turbo/c"]),
    ).toEqual(["src/a.ts"]);
  });
});
