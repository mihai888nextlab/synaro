import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import {
  SynaroLandingAgentsTeaser,
  SynaroLandingCapabilities,
  SynaroLandingHowItWorks,
} from "@/components/ui/synaro-landing-sections";

describe("Synaro landing sections", () => {
  it("renders capabilities with feature titles", () => {
    render(<SynaroLandingCapabilities />);
    expect(screen.getByText("Isolated workspaces")).toBeInTheDocument();
    expect(screen.getByText("AI that edits code")).toBeInTheDocument();
    expect(screen.getByText("Run and preview")).toBeInTheDocument();
    expect(screen.getByText("Autonomous agents")).toBeInTheDocument();
  });

  it("renders how-it-works steps", () => {
    render(<SynaroLandingHowItWorks />);
    expect(screen.getByText("Create a project")).toBeInTheDocument();
    expect(screen.getByText("Build with AI")).toBeInTheDocument();
    expect(screen.getByText("Run and ship")).toBeInTheDocument();
  });

  it("renders agents teaser with signup link", () => {
    render(<SynaroLandingAgentsTeaser />);
    expect(screen.getByText("Autonomous agents")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get started/i })).toHaveAttribute("href", "/signup");
  });
});
