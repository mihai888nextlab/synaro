import * as React from "react";

export type UseTypewriterOptions = {
  /** When false, the full text is shown immediately. */
  enabled?: boolean;
  /** Characters revealed per tick. */
  charsPerTick?: number;
  /** Milliseconds between ticks. */
  intervalMs?: number;
};

export function useTypewriter(
  text: string,
  { enabled = true, charsPerTick = 2, intervalMs = 18 }: UseTypewriterOptions = {},
): { displayed: string; isComplete: boolean } {
  const [displayed, setDisplayed] = React.useState(enabled ? "" : text);

  React.useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      return;
    }

    setDisplayed("");
    let index = 0;
    const id = window.setInterval(() => {
      index = Math.min(text.length, index + charsPerTick);
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(id);
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [text, enabled, charsPerTick, intervalMs]);

  const isComplete = !enabled || displayed.length >= text.length;
  return { displayed, isComplete };
}
