import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@jest/globals";

import { LANDING_SCREENSHOTS } from "@/lib/landing-screenshots";

const publicDir = path.join(process.cwd(), "public");

describe("landing-screenshots", () => {
  it("exports stable public paths for all slots", () => {
    expect(LANDING_SCREENSHOTS.workspace).toBe("/hero-section-photo.png");
    expect(LANDING_SCREENSHOTS.agents).toBe("/landing-agents.png");
    expect(LANDING_SCREENSHOTS.aiTask).toBe("/landing-ai-task.png");
  });

  it("wires workspace screenshot into the landing page module", () => {
    const indexSource = fs.readFileSync(
      path.join(process.cwd(), "src/pages/index.tsx"),
      "utf8",
    );
    expect(indexSource).toContain("LANDING_SCREENSHOTS.workspace");
    expect(indexSource).toContain('src={LANDING_SCREENSHOTS.workspace}');
  });

  it("has the primary workspace asset on disk", () => {
    const workspaceFile = path.join(publicDir, "hero-section-photo.png");
    expect(fs.existsSync(workspaceFile)).toBe(true);
  });
});
