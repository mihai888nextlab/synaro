import Link from "next/link";
import type { GetServerSideProps } from "next";
import { ArrowRight } from "lucide-react";

import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { SiteHeader } from "@/components/ui/site-header";
import { prisma } from "@/lib/prisma";
import { projectShareSeo, type PageSeoProps } from "@/lib/seo/page-seo";

type ProjectSharePageProps = {
  projectName: string;
  projectSlug: string;
  seo: PageSeoProps;
};

export default function ProjectSharePage({ projectName, projectSlug }: ProjectSharePageProps) {
  return (
    <main className="relative min-h-dvh bg-black text-white">
      <PageBackgroundPattern />
      <div className="relative z-10">
        <SiteHeader />
        <section className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">Synaro project</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{projectName}</h1>
          <p className="mt-4 max-w-lg text-lg text-zinc-400">
            Open this workspace on Synaro to collaborate with AI, files, and a live preview.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/projects/${encodeURIComponent(projectSlug)}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Open project
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/signup"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Create account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<ProjectSharePageProps> = async (ctx) => {
  const raw = ctx.params?.projectSlug;
  const slug = typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
  if (!slug) {
    return { notFound: true };
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { name: true, slug: true, description: true },
  });
  if (!project) {
    return { notFound: true };
  }

  return {
    props: {
      projectName: project.name,
      projectSlug: project.slug,
      seo: projectShareSeo(project.slug, project.name, project.description),
    },
  };
};
