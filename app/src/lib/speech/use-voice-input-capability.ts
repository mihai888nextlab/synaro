"use client";

import * as React from "react";

import { canUseMicrophone, supportsRecordedSpeechInput, supportsSpeechRecognition } from "@/lib/speech/capabilities";

export type VoiceInputUnsupportedReason = "no-secure-context" | "no-speech-api";

export type VoiceInputCapability =
  | { supported: true }
  | { supported: false; reason: VoiceInputUnsupportedReason };

/** Stable snapshots — useSyncExternalStore requires referential equality when unchanged. */
const CAPABILITY_SUPPORTED: VoiceInputCapability = { supported: true };
const CAPABILITY_NO_SECURE: VoiceInputCapability = {
  supported: false,
  reason: "no-secure-context",
};
const CAPABILITY_NO_SPEECH: VoiceInputCapability = {
  supported: false,
  reason: "no-speech-api",
};

export function getVoiceInputCapability(): VoiceInputCapability {
  if (!canUseMicrophone()) return CAPABILITY_NO_SECURE;
  if (supportsSpeechRecognition() || supportsRecordedSpeechInput()) return CAPABILITY_SUPPORTED;
  return CAPABILITY_NO_SPEECH;
}

/** Client-side voice (STT) availability — mic button stays visible even when unsupported. */
export function useVoiceInputCapability(): VoiceInputCapability {
  return React.useSyncExternalStore(
    () => () => {},
    getVoiceInputCapability,
    () => CAPABILITY_NO_SPEECH,
  );
}
