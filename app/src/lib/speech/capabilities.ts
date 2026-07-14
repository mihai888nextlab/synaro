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

export function supportsMediaRecorder(): boolean {
  if (typeof window === "undefined") return false;
  return typeof MediaRecorder !== "undefined";
}

/** Recorded audio + server transcription (Firefox and universal fallback). */
export function supportsRecordedSpeechInput(): boolean {
  return canUseMicrophone() && supportsMediaRecorder();
}

/** Any path that can turn mic audio into text in this browser. */
export function supportsSpeechInput(): boolean {
  return supportsSpeechRecognition() || supportsRecordedSpeechInput();
}

export function preferredRecorderMimeType(): string | null {
  if (!supportsMediaRecorder()) return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}
