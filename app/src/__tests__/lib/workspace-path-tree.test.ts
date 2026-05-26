import { describe, expect, it } from "@jest/globals";

import {
  defaultExpandedWorkspaceFolderIds,
  filePathsToTreeItems,
  relativePathFromTreeItemId,
} from "@/lib/workspace-path-tree";

describe("filePathsToTreeItems", () => {
  it("builds a root with sorted children and nested dir: / file: ids", () => {
    const items = filePathsToTreeItems(["b.ts", "a.ts", "pkg/x.ts"], "repo");
    expect(items.root).toEqual({ name: "repo", children: expect.any(Array) });
    const rootChildren = items.root!.children!;
    expect(rootChildren).toContain("file:a.ts");
    expect(rootChildren).toContain("file:b.ts");
    expect(rootChildren[0]).toMatch(/^dir:pkg$/);
    expect(items["dir:pkg"]?.children).toContain("file:pkg/x.ts");
  });

  it("deduplicates identical paths and strips ./ prefix and trailing slashes at ends (dirty crawler input)", () => {
    const items = filePathsToTreeItems(["./src/app.tsx", "src/app.tsx/", "src/app.tsx"], "r");
    expect(Object.keys(items).filter((k) => k.startsWith("file:"))).toEqual(["file:src/app.tsx"]);
  });

  it("ignores empty path segments after normalization", () => {
    const items = filePathsToTreeItems(["", "   ", "valid/readme.md"], "r");
    expect(items["file:valid/readme.md"]).toBeDefined();
    expect(items.root?.children?.some((c) => c.includes("valid"))).toBe(true);
  });

  it("lists directories before files at the same tree level", () => {
    const items = filePathsToTreeItems(["readme.md", "docs/a.ts"], "repo");
    const rc = items.root!.children!;
    expect(rc.indexOf("dir:docs")).toBeLessThan(rc.indexOf("file:readme.md"));
  });

  it("injects empty-repo hint when no file paths remain", () => {
    const items = filePathsToTreeItems([], "empty");
    expect(items.root?.children?.[0]).toBe("syn:empty-hint");
    expect(items["syn:empty-hint"]?.name).toMatch(/No files found yet|No files yet/);
  });

  it("creates intermediate folders for deep paths (monorepo layout)", () => {
    const items = filePathsToTreeItems(["packages/client/src/index.tsx"], "mono");
    expect(items["dir:packages"]).toBeDefined();
    expect(items["dir:packages/client"]).toBeDefined();
    expect(items["dir:packages/client/src"]).toBeDefined();
    expect(items["file:packages/client/src/index.tsx"]).toEqual({ name: "index.tsx" });
  });
});

describe("defaultExpandedWorkspaceFolderIds", () => {
  it("expands a single top-level directory (not root — root is hidden in the tree UI)", () => {
    const items = filePathsToTreeItems(["itecify/README.md", "itecify/src/a.ts"], "repo");
    expect(defaultExpandedWorkspaceFolderIds(items)).toEqual(["dir:itecify"]);
  });

  it("prefers the folder whose name matches the root label", () => {
    const items = filePathsToTreeItems(["itecify/a.ts", "other/b.ts"], "itecify");
    expect(defaultExpandedWorkspaceFolderIds(items)).toEqual(["dir:itecify"]);
  });

  it("returns nothing for placeholder / empty trees", () => {
    const items = filePathsToTreeItems([], "empty");
    expect(defaultExpandedWorkspaceFolderIds(items)).toEqual([]);
  });
});

describe("relativePathFromTreeItemId", () => {
  it("maps file and dir ids back to repo-relative paths", () => {
    expect(relativePathFromTreeItemId("file:src/main.ts")).toBe("src/main.ts");
    expect(relativePathFromTreeItemId("dir:src")).toBe("src");
  });

  it("returns null for synthetic and root ids (selection guard scenarios)", () => {
    expect(relativePathFromTreeItemId("root")).toBeNull();
    expect(relativePathFromTreeItemId("syn:empty-hint")).toBeNull();
    expect(relativePathFromTreeItemId("syn:status")).toBeNull();
  });

  it("returns null for unknown id prefixes (forward compatibility)", () => {
    expect(relativePathFromTreeItemId("unknown:foo")).toBeNull();
  });
});
