import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react";

import { MarkdownLite } from "@/components/ui/markdown-lite";

describe("security: MarkdownLite XSS hardening", () => {
  it("does not render raw script tags as executable elements", () => {
    const { container } = render(
      <MarkdownLite text={'<script>alert("xss")</script>'} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain('<script>alert("xss")</script>');
  });

  it("does not render inline HTML event handlers as elements", () => {
    const { container } = render(
      <MarkdownLite text={'<img src=x onerror="alert(1)">'} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("does not render javascript: links as clickable anchors", () => {
    const { container } = render(
      <MarkdownLite text={"[click me](javascript:alert('xss'))"} />,
    );

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(0);
    expect(container.textContent).toContain("click me");
  });

  it("does not render data: links as clickable anchors", () => {
    const { container } = render(
      <MarkdownLite text={"[payload](data:text/html,<script>alert(1)</script>)"} />,
    );

    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).toContain("payload");
  });

  it("still renders safe https links", () => {
    const { container } = render(
      <MarkdownLite text={"[Synaro](https://synaro.example/docs)"} />,
    );

    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href")).toBe("https://synaro.example/docs");
    expect(anchor?.getAttribute("rel")).toContain("noopener");
  });
});
