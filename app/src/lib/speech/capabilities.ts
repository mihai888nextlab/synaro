/** Web Speech API (STT) capability checks — Chrome / Edge / Safari; Firefox not targeted. */

export type SpeechRecognitionCtor = new () => SpeechRecognition;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function supportsSpeechRecognition(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/** Microphone requires a secure context (HTTPS or localhost). */
export function canUseMicrophone(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext;
}
