"use client";

import * as React from "react";

const BAR_COUNT = 28;

function defaultLevels(): number[] {
  return Array.from({ length: BAR_COUNT }, () => 0.08);
}

/**
 * Live mic levels for waveform UI (Web Audio AnalyserNode).
 * Separate from SpeechRecognition — both use the mic while `active` is true.
 */
export function useMicrophoneLevels(active: boolean) {
  const [levels, setLevels] = React.useState(defaultLevels);
  const rafRef = React.useRef<number | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const contextRef = React.useRef<AudioContext | null>(null);

  const cleanup = React.useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setLevels(defaultLevels());
  }, []);

  React.useEffect(() => {
    if (!active) {
      cleanup();
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const ctx = new AudioContext();
        contextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(data);
          const slice = data.slice(0, BAR_COUNT);
          const max = Math.max(...slice, 1);
          setLevels(
            Array.from(slice, (v) => {
              const n = v / max;
              return 0.1 + Math.min(1, n) * 0.9;
            }),
          );
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setLevels(defaultLevels());
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [active, cleanup]);

  return levels;
}
