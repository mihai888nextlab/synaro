/** @jest-environment node */

import { describe, expect, it } from "@jest/globals";

import { localeToElevenLabsLanguage } from "@/lib/elevenlabs/locale";

describe("localeToElevenLabsLanguage", () => {
  it("maps app locales to ElevenLabs language codes", () => {
    expect(localeToElevenLabsLanguage("en")).toBe("eng");
    expect(localeToElevenLabsLanguage("ro")).toBe("ron");
  });
});
