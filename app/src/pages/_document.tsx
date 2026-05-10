import { Html, Head, Main, NextScript } from "next/document";

import { appFont } from "@/lib/app-font";

export default function Document() {
  return (
    <Html lang="en" className={`${appFont.variable} ${appFont.className}`}>
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  try {
    const key = "synaro.theme.mode";
    const stored = localStorage.getItem(key);
    const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const root = document.documentElement;
    const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (resolved) => {
      root.classList.add("theme-transition");
      root.classList.toggle("dark", resolved === "dark");
      root.setAttribute("data-theme", resolved);
      root.style.colorScheme = resolved;
      window.setTimeout(() => root.classList.remove("theme-transition"), 420);
    };

    const resolve = () => {
      const prefersDark = !!(media && media.matches);
      return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    };

    apply(resolve());

    // If the user selected "system", track OS changes at the DOM level too.
    if (mode === "system" && media) {
      const onChange = () => apply(resolve());
      if (media.addEventListener) media.addEventListener("change", onChange);
      else media.addListener(onChange);
    }
  } catch {}
})();`,
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
