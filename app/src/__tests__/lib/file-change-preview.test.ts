import { buildFileChangePreview } from "@/lib/file-change-preview";

describe("buildFileChangePreview", () => {
  it("treats new files as all additions", () => {
    const preview = buildFileChangePreview("src/new.ts", "line1\nline2");
    expect(preview.fileName).toBe("new.ts");
    expect(preview.added).toBe(2);
    expect(preview.removed).toBe(0);
    expect(preview.lines.every((l) => l.kind === "add")).toBe(true);
  });

  it("computes line stats and preview for edits", () => {
    const previous = "className,\n}: {\n  className?: string;\n";
    const next = "className,\n  animate = true,\n}: {\n  className?: string;\n";
    const preview = buildFileChangePreview("ai-task-live-preview.tsx", next, previous);

    expect(preview.added).toBe(1);
    expect(preview.removed).toBe(0);
    expect(preview.lines.some((l) => l.kind === "add" && l.text.includes("animate"))).toBe(true);
  });
});
