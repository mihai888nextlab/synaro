import Link from "next/link";
import { ArrowRight, Bot, Container, MessageSquare, Play, Sparkles } from "lucide-react";

const CAPABILITIES = [
  {
    icon: Container,
    title: "Isolated workspaces",
    copy: "Each project runs in its own Docker environment with a file tree, terminal, and live preview.",
  },
  {
    icon: MessageSquare,
    title: "AI that edits code",
    copy: "Ask in natural language — Synaro reads your repo, applies changes, and shows diffs as it works.",
  },
  {
    icon: Play,
    title: "Run and preview",
    copy: "Start your app inside the container and open a live preview without leaving the dashboard.",
  },
  {
    icon: Bot,
    title: "Autonomous agents",
    copy: "Create agents with web search and HTTP tools for research and automation on your schedule.",
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Create a project",
    copy: "Import from GitHub or start from a blank workspace with a runtime container.",
  },
  {
    step: "2",
    title: "Build with AI",
    copy: "Describe what you need in chat. Synaro explores files, writes code, and applies patches safely.",
  },
  {
    step: "3",
    title: "Run and ship",
    copy: "Preview the app, iterate in the terminal, and push changes when you are ready.",
  },
] as const;

export function SynaroLandingCapabilities() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">What you get</p>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
          Everything to go from idea to running software
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {CAPABILITIES.map((item) => (
          <article
            key={item.title}
            className="rounded-xl border border-white/10 bg-zinc-950/80 p-5 sm:p-6"
          >
            <item.icon className="mb-4 size-5 text-violet-300/90" aria-hidden />
            <h3 className="mb-2 font-medium text-white">{item.title}</h3>
            <p className="text-sm leading-relaxed text-zinc-400">{item.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SynaroLandingHowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">How it works</p>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
          Three steps, one workspace
        </h2>
      </div>
      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map((item) => (
          <li
            key={item.step}
            className="rounded-xl border border-white/10 bg-zinc-950/60 p-5 sm:p-6"
          >
            <span className="mb-4 inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-zinc-300">
              {item.step}
            </span>
            <h3 className="mb-2 font-medium text-white">{item.title}</h3>
            <p className="text-sm leading-relaxed text-zinc-400">{item.copy}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SynaroLandingAgentsTeaser() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20 lg:pb-24">
      <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950/80 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex max-w-xl gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-violet-500/10">
            <Sparkles className="size-5 text-violet-300" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white sm:text-xl">Autonomous agents</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Run scheduled or on-demand agents with web search and HTTP tools — separate from
              project chat, built for longer research tasks.
            </p>
          </div>
        </div>
        <Link
          href="/signup"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 sm:self-center"
        >
          Get started
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
