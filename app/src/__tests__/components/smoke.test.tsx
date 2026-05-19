import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

describe("React smoke (Testing Library + jsdom)", () => {
  it("renders accessible text for downstream component suites", () => {
    render(
      <button type="button" aria-label="Run action">
        Run
      </button>,
    );
    expect(screen.getByRole("button", { name: "Run action" })).toBeVisible();
  });
});
