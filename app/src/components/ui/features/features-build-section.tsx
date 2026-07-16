"use client";

import { Github, Mic, Upload } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

function WorkspaceMock() {
  const { t } = useTranslation();

  const files = ["src/", "  app.tsx", "  layout.tsx", "package.json", "README.md"];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-[0_24px_80px_rgba(255,255,255,0.06)]"
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/30" />
          <span className="size-2.5 rounded-full bg-white/50" />
          <span className="size-2.5 rounded-full bg-white/70" />
        </div>
        <span className="text-xs text-zinc-500">my-app · workspace</span>
      </div>
      <div className="flex border-b border-white/10 text-[11px]">
        {[
          t("features.mock.workspaceTabFiles"),
          t("features.mock.workspaceTabTerminal"),
          t("features.mock.workspaceTabPreview"),
        ].map((label, i) => (
          <span
            key={label}
            className={cn(
              "border-b-2 px-4 py-2 font-medium transition-colors",
              i === 0 ? "border-white text-white" : "border-transparent text-zinc-500",
            )}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid min-h-[260px] grid-cols-5 sm:min-h-[300px]">
        <div className="col-span-2 border-r border-white/8 bg-black/40 p-3 font-mono text-[10px] leading-5 text-zinc-500 sm:text-[11px]">
          {files.map((line) => (
            <div
              key={line}
              className={cn(line.startsWith("  ") ? "pl-2 text-zinc-600" : "text-zinc-400")}
            >
              {line}
            </div>
          ))}
        </div>
        <div className="col-span-3 flex flex-col">
          <div className="flex-1 border-b border-white/8 bg-black/60 p-3 font-mono text-[10px] sm:text-[11px]">
            <p className="text-white/90">{t("features.mock.terminalLine1")}</p>
            <p className="mt-1 text-white/40">{t("features.mock.terminalLine2")}</p>
          </div>
          <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-white/[0.06] via-zinc-950 to-black p-4">
            <div className="h-full w-full max-w-[140px] rounded-lg border border-white/15 bg-white/[0.03] p-2">
              <div className="mb-2 h-1.5 w-8 rounded bg-white/25" />
              <div className="space-y-1.5">
                <div className="h-1 w-full rounded bg-white/10" />
                <div className="h-1 w-4/5 rounded bg-white/10" />
                <div className="h-6 w-full rounded bg-white/20" />
              </div>
            </div>
            <span className="absolute bottom-2 right-3 text-[9px] uppercase tracking-wider text-white/50">
              live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoiceWaveform() {
  return (
    <div className="flex h-8 items-end justify-center gap-1" aria-hidden>
      {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.45].map((h, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-white/70 motion-safe:animate-pulse"
          style={{
            height: `${h * 100}%`,
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

const BUILD_ITEMS: {
  id: string;
  titleKey: string;
  bodyKey: string;
  num: string;
  waveform?: boolean;
  icons?: typeof Github[];
}[] = [
  {
    id: "workspaces",
    titleKey: "features.workspaces.title",
    bodyKey: "features.workspaces.body",
    num: "01",
  },
  {
    id: "ai-chat",
    titleKey: "features.aiChat.title",
    bodyKey: "features.aiChat.body",
    num: "02",
  },
  {
    id: "voice",
    titleKey: "features.voice.title",
    bodyKey: "features.voice.body",
    num: "03",
    waveform: true,
  },
  {
    id: "import",
    titleKey: "features.import.title",
    bodyKey: "features.import.body",
    num: "04",
    icons: [Github, Upload],
  },
];

export function FeaturesBuildSection() {
  const { t } = useTranslation();

  return (
    <section
      id="build"
      className="relative mx-auto max-w-7xl scroll-mt-24 px-4 pb-20 sm:px-6 sm:pb-28"
    >
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-white/70">
          {t("features.sections.build")}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
          {t("features.sections.buildTagline")}
        </h2>
      </div>

      <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <WorkspaceMock />

        <ol className="relative space-y-8 lg:pt-4">
          <div className="absolute bottom-4 left-[15px] top-4 w-px bg-white/10" aria-hidden />
          {BUILD_ITEMS.map((item) => (
            <li key={item.id} id={item.id} className="relative scroll-mt-24 pl-10">
              <span className="absolute left-0 top-0.5 flex size-8 items-center justify-center rounded-full border border-white/25 bg-zinc-950 font-mono text-[10px] font-medium text-white">
                {item.num}
              </span>
              <h3 className="text-lg font-medium text-white">{t(item.titleKey)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{t(item.bodyKey)}</p>

              {item.id === "ai-chat" ? (
                <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-xs text-white/85">
                  <span className="text-white/55">Synaro · </span>
                  {t("features.mock.aiQuestion")}
                </div>
              ) : null}

              {item.waveform ? (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1">
                  <Mic className="size-3.5 text-white" aria-hidden />
                  <span className="text-xs text-white/85">{t("features.mock.voiceListening")}</span>
                  <VoiceWaveform />
                </div>
              ) : null}

              {item.icons ? (
                <div className="mt-3 flex gap-2">
                  {item.icons.map((Icon) => (
                    <span
                      key={Icon.displayName ?? Icon.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400"
                    >
                      <Icon className="size-3.5 text-white" aria-hidden />
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
