const INTER_BOLD_URL =
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZJhiI2g.woff";
const INTER_REGULAR_URL =
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyYAZJhiI2g.woff";

let fontsPromise: Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]
> | null = null;

export function loadOgFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      fetch(INTER_REGULAR_URL).then((res) => res.arrayBuffer()),
      fetch(INTER_BOLD_URL).then((res) => res.arrayBuffer()),
    ]).then(([regular, bold]) => [
      { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
    ]);
  }
  return fontsPromise;
}
