import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Cloud, Lock, Server, Zap } from "lucide-react";
import type { GetServerSideProps } from "next";

import { Features } from "@/components/ui/features-8";
import { MinimalFooter } from "@/components/ui/minimal-footer";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { SiteHeader } from "@/components/ui/site-header";
import { redirectIfAuthed } from "@/lib/auth-redirect";

function HeroScrollDemo() {
  return (
    <div className="flex flex-col overflow-hidden pb-8 pt-24 sm:pb-12 sm:pt-36 md:pb-16 md:pt-56 lg:pb-24 lg:pt-72">
      <ContainerScroll
        titleComponent={
          <div>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
              Operate every cloud with one platform.
              <br />
              <span className="mt-1 text-3xl font-bold leading-none sm:text-4xl md:text-[4rem] lg:text-[5rem]">
                Synaro Control Plane
              </span>
            </h1>
          </div>
        }
      >
        <Image
          src="/hero-section-photo.png"
          alt="Cloud infrastructure dashboard"
          height={720}
          width={1400}
          className="mx-auto h-full rounded-2xl object-cover object-left-top"
          draggable={false}
        />
      </ContainerScroll>
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <PageBackgroundPattern />
      <div className="relative z-10">
      <SiteHeader />
      <HeroGeometric
        badge="Synaro Cloud Platform"
        title1="Build cloud infrastructure"
        title2="without the complexity"
      />

      <section className="relative mx-auto -mt-16 max-w-6xl overflow-hidden px-4 pb-10 sm:-mt-20 sm:px-6 sm:pb-12 lg:-mt-24 lg:pb-14">
        <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
        <div className="relative z-10 rounded-2xl border border-white/15 bg-zinc-950 p-8 shadow-2xl md:p-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-4 text-sm uppercase tracking-[0.2em] text-zinc-400">
                Why teams choose Synaro
              </p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Launch secure, production-ready cloud stacks in minutes.
              </h2>
            </div>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Start free trial
              <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Cloud,
                title: "Multi-cloud by default",
                copy: "Provision AWS, GCP, and Azure with a single declarative workflow.",
              },
              {
                icon: Lock,
                title: "Security built in",
                copy: "Policy controls, encryption defaults, and audit trails on every deploy.",
              },
              {
                icon: Zap,
                title: "Fast operations",
                copy: "Detect drift, roll back safely, and keep environments consistent.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-white/10 bg-black p-5"
              >
                <item.icon className="mb-3 size-5 text-white" />
                <h3 className="mb-2 font-medium">{item.title}</h3>
                <p className="text-sm text-zinc-400">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative -mt-2 overflow-hidden sm:-mt-4 lg:-mt-6">
        <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
        <div className="relative z-10">
          <HeroScrollDemo />
        </div>
      </section>

      <section className="relative -mt-6 overflow-hidden sm:-mt-10 lg:-mt-14">
        <PageBackgroundPattern variant="section" className="z-0 opacity-75" />
        <div className="relative z-10">
          <Features />
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
        <div className="relative z-10 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-zinc-950 p-6 sm:p-8">
            <Server className="mb-4 size-6" />
            <h3 className="mb-3 text-xl font-semibold sm:text-2xl">Platform reliability</h3>
            <ul className="flex flex-col gap-3 text-zinc-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-white" />
                Deployment previews for every infrastructure change
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-white" />
                Built-in rollback and versioned environment snapshots
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 text-white" />
                Team-level permissions with approval policies
              </li>
            </ul>
          </article>
          <article className="rounded-2xl border border-white/10 bg-zinc-950 p-6 sm:p-8">
            <h3 className="mb-3 text-xl font-semibold sm:text-2xl">Trusted by modern B2B teams</h3>
            <p className="text-zinc-400">
              &quot;Synaro gave our team the confidence to scale from one region to
              nine, without adding operational overhead.&quot;
            </p>
            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="font-medium">Andrei M.</p>
              <p className="text-sm text-zinc-500">
                Head of Platform Engineering, Northgrid
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-4 pb-16 sm:px-6 sm:pb-20 lg:pb-24">
        <PageBackgroundPattern variant="section" className="z-0 opacity-70" />
        <div className="relative z-10 rounded-3xl border border-white/15 bg-gradient-to-b from-zinc-900 to-black p-6 text-center sm:p-10 md:p-14 lg:p-16">
          <h2 className="text-2xl font-semibold sm:text-3xl md:text-4xl lg:text-5xl">
            Ready to simplify your cloud infrastructure?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
            Start with a clean, governed foundation and give every engineering team
            a safer path to production.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Start free trial
            </a>
            <Link
              href="/pricing"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      <MinimalFooter />
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard");
