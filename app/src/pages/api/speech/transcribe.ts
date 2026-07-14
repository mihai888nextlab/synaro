import busboy from "busboy";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { isLocale, type Locale } from "@/i18n/config";
import { ElevenLabsApiError, elevenLabsSpeechToText } from "@/lib/elevenlabs/client";
import { isElevenLabsConfigured } from "@/lib/elevenlabs/config";
import { authOptions } from "@/lib/next-auth-options";

export const config = {
  api: { bodyParser: false },
};

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

type ParsedTranscribe = {
  locale: Locale;
  audio: Buffer;
  mimeType: string;
};

function parseTranscribeMultipart(req: NextApiRequest): Promise<ParsedTranscribe> {
  return new Promise((resolve, reject) => {
    let locale: Locale | null = null;
    let audio: Buffer | null = null;
    let mimeType = "audio/webm";

    const bb = busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_AUDIO_BYTES },
    });

    bb.on("field", (name, value) => {
      if (name !== "locale") return;
      const raw = typeof value === "string" ? value : String(value);
      if (isLocale(raw)) locale = raw;
    });

    bb.on("file", (name, file, info) => {
      if (name !== "audio") {
        file.resume();
        return;
      }
      mimeType = info.mimeType || "audio/webm";
      const chunks: Buffer[] = [];
      file.on("data", (chunk: Buffer) => chunks.push(chunk));
      file.on("limit", () => reject(new Error("AUDIO_TOO_LARGE")));
      file.on("end", () => {
        audio = Buffer.concat(chunks);
      });
    });

    bb.on("error", reject);
    bb.on("finish", () => {
      if (!locale || !audio || audio.length === 0) {
        reject(new Error("INVALID_MULTIPART"));
        return;
      }
      resolve({ locale, audio, mimeType });
    });

    req.pipe(bb);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ text: string } | { error: string }>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (!isElevenLabsConfigured()) {
    return res.status(503).json({ error: "Speech transcription is not configured." });
  }

  let parsed: ParsedTranscribe;
  try {
    parsed = await parseTranscribeMultipart(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "AUDIO_TOO_LARGE") {
      return res.status(413).json({ error: "Audio file is too large." });
    }
    return res.status(400).json({ error: "Invalid audio upload." });
  }

  try {
    const text = await elevenLabsSpeechToText(parsed.audio, parsed.locale, parsed.mimeType);
    return res.status(200).json({ text });
  } catch (err) {
    if (err instanceof ElevenLabsApiError) {
      return res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({
        error: "Speech transcription failed.",
      });
    }
    return res.status(500).json({ error: "Speech transcription failed." });
  }
}
