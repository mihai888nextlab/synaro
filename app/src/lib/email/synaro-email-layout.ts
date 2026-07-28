import { absoluteUrl } from "@/lib/seo/site-metadata";

export type SynaroEmailLayoutProps = {
  previewText: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
  footerNote?: string;
  /** Wider content for rich run emails (artifacts). Default 480. */
  contentMaxWidthPx?: number;
};

export function buildSynaroEmailHtml({
  previewText,
  title,
  body,
  buttonLabel,
  buttonHref,
  footerNote,
  contentMaxWidthPx = 480,
}: SynaroEmailLayoutProps): string {
  const safeHref = buttonHref.replace(/"/g, "&quot;");
  const maxWidth = Math.min(Math.max(contentMaxWidthPx, 320), 720);
  const footer = footerNote
    ? `<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#71717a;">${footerNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previewText}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:${maxWidth}px;background-color:#111111;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px 28px;">
          <tr>
            <td style="font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#ffffff;">Synaro</td>
          </tr>
          <tr>
            <td style="padding-top:24px;font-size:20px;font-weight:600;line-height:1.3;letter-spacing:-0.02em;color:#ffffff;">${title}</td>
          </tr>
          <tr>
            <td style="padding-top:12px;font-size:14px;line-height:1.65;color:#a1a1aa;">${body}</td>
          </tr>
          <tr>
            <td style="padding-top:28px;">
              <a href="${safeHref}" style="display:inline-block;background-color:#ffffff;color:#0a0a0a;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:999px;">${buttonLabel}</a>
            </td>
          </tr>
          ${footer}
          <tr>
            <td style="padding-top:32px;font-size:11px;line-height:1.5;color:#52525b;">synaro.tech</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildSynaroEmailText({
  title,
  body,
  buttonLabel,
  buttonHref,
  footerNote,
}: Omit<SynaroEmailLayoutProps, "previewText">): string {
  const lines = [title, "", body, "", `${buttonLabel}: ${buttonHref}`];
  if (footerNote) lines.push("", footerNote);
  lines.push("", "— Synaro", "synaro.tech");
  return lines.join("\n");
}

export function authActionUrl(path: string, token: string): string {
  const base = absoluteUrl(path);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}
