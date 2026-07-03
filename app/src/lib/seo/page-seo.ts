import type { SynaroPageHeadProps } from "@/components/seo/synaro-page-head";
import type { Locale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { DEFAULT_DOC_SLUG, getDocPage } from "@/lib/documentation";
import { DEFAULT_DESCRIPTION } from "@/lib/seo/site-metadata";

export type PageSeoProps = SynaroPageHeadProps;

export function mergePageSeo(
  base: SynaroPageHeadProps,
  override?: Partial<SynaroPageHeadProps> | null,
): SynaroPageHeadProps {
  if (!override) return base;
  return {
    ...base,
    ...override,
    ogParams:
      base.ogParams || override.ogParams
        ? { ...base.ogParams, ...override.ogParams }
        : undefined,
  };
}

export function homePageSeo(): PageSeoProps {
  return {
    title: "Build and run software with AI",
    description:
      "Describe your app in plain language. Synaro scaffolds code, runs Docker workspaces, and ships agents with a public API.",
    path: "/",
    ogType: "site",
  };
}

export function pricingPageSeo(): PageSeoProps {
  return {
    title: "Pricing",
    description: "Flexible plans for developers and teams building on Synaro.",
    path: "/pricing",
    ogType: "site",
  };
}

export function loginPageSeo(): PageSeoProps {
  return {
    title: "Sign in",
    description: "Sign in to your Synaro workspace, projects, and agents.",
    path: "/login",
    ogType: "site",
  };
}

export function signupPageSeo(): PageSeoProps {
  return {
    title: "Create account",
    description: "Create a free Synaro account and start your first project in minutes.",
    path: "/signup",
    ogType: "site",
  };
}

export function docPageSeo(slug: string, locale: Locale = DEFAULT_LOCALE): PageSeoProps {
  const page = getDocPage(slug, locale);
  const resolvedSlug = page?.slug ?? slug;
  return {
    title: page?.title ?? "Documentation",
    description: page?.description ?? "Guides for projects, workspaces, agents, and the Synaro API.",
    path: resolvedSlug === DEFAULT_DOC_SLUG ? "/documentation" : `/documentation/${resolvedSlug}`,
    ogType: "doc",
    ogParams: { slug: resolvedSlug },
  };
}

export function invitePageSeo(token: string, projectName: string): PageSeoProps {
  return {
    title: `Join ${projectName}`,
    description: `You've been invited to collaborate on ${projectName} in Synaro.`,
    path: `/projects/invite/${token}`,
    ogType: "invite",
    ogParams: { token },
  };
}

export function projectShareSeo(
  slug: string,
  name: string,
  description?: string | null,
): PageSeoProps {
  return {
    title: name,
    description: description?.trim() || `Open the ${name} workspace on Synaro.`,
    path: `/p/${slug}`,
    ogType: "project",
    ogParams: { slug },
  };
}

export function projectWorkspaceSeo(
  slug: string,
  name: string,
  description?: string | null,
): PageSeoProps {
  return {
    title: name,
    description: description?.trim() || DEFAULT_DESCRIPTION,
    path: `/projects/${slug}`,
    ogType: "project",
    ogParams: { slug },
    noIndex: true,
  };
}

export function agentsPageSeo(highlightAgentId?: string): PageSeoProps {
  if (highlightAgentId) {
    return {
      title: "Agent",
      description: "Autonomous agent on Synaro.",
      path: "/agents",
      ogType: "agent",
      ogParams: { id: highlightAgentId },
      noIndex: true,
    };
  }
  return {
    title: "Agents",
    description: "Create and run autonomous agents with tools and schedules.",
    path: "/agents",
    ogType: "site",
    noIndex: true,
  };
}

export function dashboardPageSeo(): PageSeoProps {
  return {
    title: "Dashboard",
    description: "Your Synaro dashboard — projects, agents, and activity.",
    path: "/dashboard",
    ogType: "site",
    noIndex: true,
  };
}
