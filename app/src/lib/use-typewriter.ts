import * as React from "react";

export type UseTypewriterOptions = {
  /** When false, the full text is shown immediately. */
  enabled?: boolean;
  /** Characters revealed per tick. */
  charsPerTick?: number;
  /** Milliseconds between ticks. */
  intervalMs?: number;
  /** When behind the target by this many chars, type faster to catch up. */
  catchUpThreshold?: number;
  /** Chars per tick while catching up. */
  catchUpCharsPerTick?: number;
};

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * Reveals `text` gradually. When `text` grows and still shares a prefix with what
 * was already revealed, animation continues from the cursor instead of restarting.
 */
export function useTypewriter(
  text: string,
  {
    enabled = true,
    charsPerTick = 2,
    intervalMs = 18,
    catchUpThreshold = 40,
    catchUpCharsPerTick = 32,
  }: UseTypewriterOptions = {},
): { displayed: string; isComplete: boolean } {
  const targetTextRef = React.useRef(text);
  const indexRef = React.useRef(enabled ? 0 : text.length);
  const prevTextRef = React.useRef(text);
  const [displayed, setDisplayed] = React.useState(() => (enabled ? "" : text));

  targetTextRef.current = text;

  React.useEffect(() => {
    if (!enabled) {
      indexRef.current = text.length;
      setDisplayed(text);
      prevTextRef.current = text;
      return;
    }

    const prev = prevTextRef.current;
    prevTextRef.current = text;

    if (text === prev) return;

    const revealed = prev.slice(0, indexRef.current);
    if (text.startsWith(revealed)) {
      indexRef.current = Math.min(indexRef.current, text.length);
    } else {
      indexRef.current = commonPrefixLength(revealed, text);
    }

    setDisplayed(text.slice(0, indexRef.current));
  }, [text, enabled]);

  React.useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      const target = targetTextRef.current;
      if (indexRef.current >= target.length) return;
      const behind = target.length - indexRef.current;
      const step =
        behind > catchUpThreshold
          ? Math.max(catchUpCharsPerTick, charsPerTick)
          : charsPerTick;
      indexRef.current = Math.min(target.length, indexRef.current + step);
      setDisplayed(target.slice(0, indexRef.current));
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, charsPerTick, intervalMs, catchUpThreshold, catchUpCharsPerTick]);

  const isComplete = !enabled || (displayed.length >= text.length && text.startsWith(displayed));
  return { displayed, isComplete };
}
