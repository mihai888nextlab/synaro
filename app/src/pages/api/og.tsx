import type { NextApiRequest, NextApiResponse } from "next";

import { generateOgImageBuffer } from "@/lib/seo/generate-og-image";
import { fallbackOgContent, resolveOgContent } from "@/lib/seo/resolve-og-content";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const type = typeof req.query.type === "string" ? req.query.type : "site";

  try {
    const content = (await resolveOgContent(type, req.query)) ?? fallbackOgContent();
    const buffer = await generateOgImageBuffer(content);
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.status(200).send(buffer);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to generate OG image", detail });
  }
}
