import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { GetServerSideProps } from "next";

import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { MinimalFooter } from "@/components/ui/minimal-footer";
import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import { SiteHeader } from "@/components/ui/site-header";
import {
  SynaroLandingAgentsTeaser,
  SynaroLandingCapabilities,
  SynaroLandingHowItWorks,
} from "@/components/ui/synaro-landing-sections";
import { LANDING_SCREENSHOTS } from "@/lib/landing-screenshots";
import { redirectIfAuthed } from "@/lib/auth-redirect";

function ProductScreenshotSection() {
  return (
    <section className="relative overflow-hidden pb-8 pt-4 sm:pb-12 sm:pt-8">
      <ContainerScroll
        titleComponent={
          <div className="px-4">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">
              Inside the workspace
            </p>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
              File tree, AI chat, and live preview
              <span className="mt-2 block text-lg font-normal text-zinc-400 sm:text-xl">
                in one project view
              </span>
            </h2>
          </div>
        }
      >
        <Image
          src={LANDING_SCREENSHOTS.workspace}
          alt="Synaro project workspace with file explorer, AI chat, and app preview"
          height={720}
          width={1400}
          className="mx-auto h-full rounded-2xl object-cover object-left-top"
          draggable={false}
          priority
        />
      </ContainerScroll>
    </section>
  );
}

export default function Home() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-black text-white">
      <PageBackgroundPattern />
      <div className="relative z-10">
        <SiteHeader />

        <HeroGeometric
          badge="Developer workspace"
          title1="Build and run software"
          title2="with AI in isolated workspaces"
          description="Create projects in Docker, edit code with an AI assistant, preview your app, and run autonomous agents — without juggling a dozen tools."
          actions={
            <>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Get started
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/documentation"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Read the docs
              </Link>
            </>
          }
        />

        <ProductScreenshotSection />

        <SynaroLandingCapabilities />

        <SynaroLandingHowItWorks />

        <SynaroLandingAgentsTeaser />

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20 lg:pb-24">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-zinc-900 to-black p-6 text-center sm:p-10 md:p-14 lg:p-16">
            <h2 className="text-2xl font-semibold sm:text-3xl md:text-4xl">
              Ready to open your first workspace?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Sign up, create a project, and start building with AI in a container that is
              yours alone.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Create free account
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Sign in
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
