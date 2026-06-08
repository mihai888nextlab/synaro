import { describe, expect, it } from "@jest/globals";

import { isGitOnlyWorkflowPrompt } from "@/lib/git-workflow-prompt";

describe("isGitOnlyWorkflowPrompt", () => {
  it("skips clarify for create repo and push", () => {
    expect(
      isGitOnlyWorkflowPrompt(
        "Create a private GitHub repo named itecify-demo and push this project",
      ),
    ).toBe(true);
  });

  it("does not skip clarify for feature + push", () => {
    expect(isGitOnlyWorkflowPrompt("Add a login page and push to GitHub")).toBe(false);
  });

  it("skips clarify for commit and push", () => {
    expect(isGitOnlyWorkflowPrompt("commit and push my changes")).toBe(true);
  });
});
