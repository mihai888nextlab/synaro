import { ImageResponse } from "next/og";

import { OgCardLayout } from "@/lib/seo/og-card-layout";
import type { OgCardContent } from "@/lib/seo/resolve-og-content";
import { loadOgFonts } from "@/lib/seo/og-fonts";

export async function generateOgImageBuffer(content: OgCardContent): Promise<Buffer> {
  const fonts = await loadOgFonts();
  const image = new ImageResponse(OgCardLayout(content), {
    width: 1200,
    height: 630,
    fonts,
  });
  return Buffer.from(await image.arrayBuffer());
}
