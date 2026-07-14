import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { isLocale, type Locale } from "@/i18n/config";
import { ElevenLabsApiError, elevenLabsTextToSpeech } from "@/lib/elevenlabs/client";
import { isElevenLabsTtsConfigured } from "@/lib/elevenlabs/config";
import { authOptions } from "@/lib/next-auth-options";

const MAX_TEXT_CHARS = 8_000;

type SynthesizeBody = {
  text?: string;
  locale?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (!isElevenLabsTtsConfigured()) {
    return res.status(503).json({ error: "Speech synthesis is not configured." });
  }

  const body = req.body as SynthesizeBody;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const localeRaw = body.locale;

  if (!text) {
    return res.status(400).json({ error: "Text is required." });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return res.status(400).json({ error: "Text is too long." });
  }
  if (typeof localeRaw !== "string" || !isLocale(localeRaw)) {
    return res.status(400).json({ error: "Invalid locale." });
  }

  const locale = localeRaw as Locale;

  try {
    const audio = await elevenLabsTextToSpeech(text, locale);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(audio));
  } catch (err) {
    if (err instanceof ElevenLabsApiError) {
      return res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({
        error: "Speech synthesis failed.",
      });
    }
    return res.status(500).json({ error: "Speech synthesis failed." });
  }
}
