import { renderHook, act } from "@testing-library/react";

import { useTypewriter } from "@/lib/use-typewriter";

describe("useTypewriter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reveals text gradually when enabled", () => {
    const { result } = renderHook(() =>
      useTypewriter("hello", { enabled: true, charsPerTick: 1, intervalMs: 10 }),
    );

    expect(result.current.displayed).toBe("");
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current.displayed.length).toBeGreaterThan(0);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.displayed).toBe("hello");
    expect(result.current.isComplete).toBe(true);
  });

  it("shows full text immediately when disabled", () => {
    const { result } = renderHook(() => useTypewriter("instant", { enabled: false }));
    expect(result.current.displayed).toBe("instant");
    expect(result.current.isComplete).toBe(true);
  });
});
