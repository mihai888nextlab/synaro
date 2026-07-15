/** @jest-environment node */

import { afterEach, describe, expect, it } from "@jest/globals";

import { getElevenLabsConfig, isElevenLabsConfigured, isElevenLabsTtsConfigured, voiceIdForLocale } from "@/lib/elevenlabs/config";

const ORIGINAL_ENV = process.env;

describe("elevenlabs config", () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("reports unconfigured when API key is missing", () => {
    process.env = { ...ORIGINAL_ENV, ELEVENLABS_API_KEY: "" };
    expect(isElevenLabsConfigured()).toBe(false);
    expect(isElevenLabsTtsConfigured()).toBe(false);
  });

  it("requires a voice id for TTS", () => {
    process.env = {
      ...ORIGINAL_ENV,
      ELEVENLABS_API_KEY: "test-key",
      ELEVENLABS_VOICE_ID_EN: "",
      ELEVENLABS_VOICE_ID_RO: "",
    };
    expect(isElevenLabsConfigured()).toBe(true);
    expect(isElevenLabsTtsConfigured()).toBe(false);
  });

  it("resolves locale voice ids with English fallback", () => {
    process.env = {
      ...ORIGINAL_ENV,
      ELEVENLABS_API_KEY: "test-key",
      ELEVENLABS_VOICE_ID_EN: "voice-en",
      ELEVENLABS_VOICE_ID_RO: "",
    };
    expect(voiceIdForLocale("en")).toBe("voice-en");
    expect(voiceIdForLocale("ro")).toBe("voice-en");
  });

  it("uses defaults for model ids", () => {
    process.env = {
      ...ORIGINAL_ENV,
      ELEVENLABS_API_KEY: "test-key",
    };
    const cfg = getElevenLabsConfig();
    expect(cfg.ttsModel).toBe("eleven_multilingual_v2");
    expect(cfg.sttModel).toBe("scribe_v2");
  });
});
