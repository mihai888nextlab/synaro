import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import { MarkdownLite } from "@/components/ui/markdown-lite";

describe("MarkdownLite", () => {
  it("renders bold and italic inline markdown", () => {
    const { container } = render(<MarkdownLite text="**bold** and *italic*" />);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders bullet lists", () => {
    const { container } = render(
      <MarkdownLite text={"- first item\n- second item"} />,
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe("first item");
    expect(items[1]?.textContent).toBe("second item");
  });

  it("renders fenced code blocks", () => {
    const { container } = render(
      <MarkdownLite text={"```\nconst x = 1;\n```"} />,
    );
    const pre = container.querySelector("pre code");
    expect(pre?.textContent).toContain("const x = 1;");
  });

  it("renders GFM-style tables", () => {
    render(
      <MarkdownLite
        text={`| Rank | University |
|------|------------|
| 1 | MIT |
| 2 | Stanford |`}
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("Stanford")).toBeInTheDocument();
    expect(screen.getByText("University")).toBeInTheDocument();
  });

  it("renders headings", () => {
    const { container } = render(<MarkdownLite text="## Section title" />);
    expect(container.querySelector("h3")?.textContent).toBe("Section title");
  });

  it("renders h4–h6 atx headings including trailing hashes", () => {
    const { container } = render(
      <MarkdownLite text={"#### Why It Matters\n\n##### Details ####"} />,
    );
    expect(container.querySelector("h5")?.textContent).toBe("Why It Matters");
    expect(container.querySelectorAll("h5")).toHaveLength(2);
    expect(container.querySelectorAll("h5")[1]?.textContent).toBe("Details");
  });

  it("renders thematic breaks for --- *** and ___", () => {
    const { container } = render(
      <MarkdownLite text={"Before\n\n---\n\nAfter\n\n***\n\n___\n"} />,
    );
    expect(container.querySelectorAll("hr")).toHaveLength(3);
  });
});
