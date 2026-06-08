import {
  defaultFolderImportName,
  sanitizeUploadRelativePath,
  stripSharedRootPath,
} from "@/lib/import-folder-paths";

describe("import-folder-paths", () => {
  it("stripSharedRootPath removes one common directory", () => {
    expect(stripSharedRootPath(["my-app/a.txt", "my-app/src/b.ts"])).toEqual(["a.txt", "src/b.ts"]);
  });

  it("sanitizeUploadRelativePath rejects traversal", () => {
    expect(sanitizeUploadRelativePath("../evil")).toBeNull();
    expect(sanitizeUploadRelativePath("ok/nested")).toBe("ok/nested");
  });

  it("defaultFolderImportName uses shared folder", () => {
    expect(defaultFolderImportName(["my-app/package.json", "my-app/README.md"])).toBe("my-app");
  });
});
