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

  it("continues from the cursor when text grows", () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTypewriter(text, { enabled: true, charsPerTick: 5, intervalMs: 10 }),
      { initialProps: { text: "hello" } },
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.displayed).toBe("hello");
    expect(result.current.isComplete).toBe(true);

    rerender({ text: "hello world" });
    expect(result.current.displayed).toBe("hello");
    expect(result.current.isComplete).toBe(false);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.displayed).toBe("hello world");
    expect(result.current.isComplete).toBe(true);
  });
});
