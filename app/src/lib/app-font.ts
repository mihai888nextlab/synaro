import { Inter } from "next/font/google";

/** Single source of truth: applied on `<Html>` in `_document.tsx` so dashboard and all routes match. */
export const appFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app-sans",
});
