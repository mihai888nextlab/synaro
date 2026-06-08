import "@testing-library/jest-dom";

if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = function timeout(ms: number): AbortSignal {
    const c = new AbortController();
    setTimeout(() => c.abort(new DOMException("TimeoutError", "AbortError")), ms);
    return c.signal;
  };
}
