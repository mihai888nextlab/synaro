import type { OgCardContent } from "@/lib/seo/resolve-og-content";
import { SITE_NAME } from "@/lib/seo/site-metadata";

/** JSX tree for `next/og` ImageResponse — Luma-inspired dark card. */
export function OgCardLayout({ title, subtitle, badge, accentLabel }: OgCardContent) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "Inter",
        padding: 56,
        gap: 48,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#a1a1aa",
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, justifyContent: "center" }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "#ffffff",
              maxHeight: 200,
              overflow: "hidden",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.35,
              color: "#a1a1aa",
              maxHeight: 108,
              overflow: "hidden",
            }}
          >
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 28px",
              borderRadius: 999,
              background: "#ffffff",
              color: "#0a0a0a",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {badge} · {SITE_NAME}
          </div>
        </div>
      </div>

      <div
        style={{
          width: 300,
          height: 300,
          alignSelf: "center",
          flexShrink: 0,
          borderRadius: 28,
          background: "linear-gradient(145deg, #7c3aed 0%, #4f46e5 55%, #312e81 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.05em",
          }}
        >
          {accentLabel}
        </div>
      </div>
    </div>
  );
}
