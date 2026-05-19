import { describe, expect, it } from "@jest/globals";

import { cn } from "@/lib/utils";

describe("cn (tailwind class merge)", () => {
  it("merges conflicting Tailwind utilities using tailwind-merge semantics", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-600")).toBe("text-blue-600");
  });

  it("supports conditional class lists (UI state matrix)", () => {
    const active = true;
    expect(cn("base", active && "active", !active && "inactive")).toBe("base active");
  });

  it("filters falsy values from clsx", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("handles arbitrary property conflicts last-wins", () => {
    expect(cn("p-[10px]", "p-4")).toBe("p-4");
  });
});
