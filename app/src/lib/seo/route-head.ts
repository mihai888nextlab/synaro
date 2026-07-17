import type { SynaroPageHeadProps } from "@/components/seo/synaro-page-head";
import { DEFAULT_DOC_SLUG } from "@/lib/documentation";
import {
  agentsPageSeo,
  agentsRunDetailSeo,
  dashboardPageSeo,
  docPageSeo,
  featuresPageSeo,
  contactPageSeo,
  forgotPasswordPageSeo,
  homePageSeo,
  loginPageSeo,
  pricingPageSeo,
  projectWorkspaceSeo,
  resetPasswordPageSeo,
  signupPageSeo,
  verifyEmailPageSeo,
} from "@/lib/seo/page-seo";

const PRIVATE_ROUTE_PREFIXES = ["/dashboard", "/settings", "/logs", "/projects", "/agents"];

/** Authenticated app shell routes (dashboard, projects, agents, logs, settings). */
export function isPrivateAppRoute(pathname: string): boolean {
  if (pathname === "/projects/invite/[token]") return false;
  if (pathname === "/p/[projectSlug]") return false;
  if (pathname === "/a/[agentId]") return false;
  if (pathname === "/documentation" || pathname === "/documentation/[slug]") return false;
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function routeHeadProps(
  pathname: string,
  query: Record<string, string | string[] | undefined>,
  asPath: string,
): SynaroPageHeadProps {
  const path = asPath.split("?")[0] || "/";

  if (pathname === "/") {
    return homePageSeo();
  }

  if (pathname === "/documentation" || pathname === "/documentation/[slug]") {
    const slug = typeof query.slug === "string" && query.slug.length > 0 ? query.slug : DEFAULT_DOC_SLUG;
    return docPageSeo(slug);
  }

  if (pathname === "/projects/invite/[token]") {
    const token = typeof query.token === "string" ? query.token : "";
    return {
      title: "Project invite",
      description: "Join a shared Synaro project workspace.",
      path,
      ogType: "invite",
      ogParams: { token },
    };
  }

  if (pathname === "/p/[projectSlug]") {
    const slug = typeof query.projectSlug === "string" ? query.projectSlug : "";
    return {
      title: "Project",
      description: "Open a Synaro project workspace.",
      path,
      ogType: "project",
      ogParams: { slug },
    };
  }

  if (pathname === "/a/[agentId]") {
    const id = typeof query.agentId === "string" ? query.agentId : "";
    return {
      title: "Agent",
      description: "Open an autonomous agent on Synaro.",
      path,
      ogType: "agent",
      ogParams: { id },
    };
  }

  if (pathname === "/features") {
    return featuresPageSeo();
  }

  if (pathname === "/contact") {
    return contactPageSeo();
  }

  if (pathname === "/projects/[projectSlug]" || pathname.startsWith("/projects/[projectSlug]/")) {
    const slug = typeof query.projectSlug === "string" ? query.projectSlug : "";
    return projectWorkspaceSeo(slug, "Project workspace");
  }

  if (pathname === "/pricing") {
    return pricingPageSeo();
  }

  if (pathname === "/login") {
    return loginPageSeo();
  }

  if (pathname === "/signup") {
    return signupPageSeo();
  }

  if (pathname === "/forgot-password") {
    return forgotPasswordPageSeo();
  }

  if (pathname === "/reset-password") {
    return resetPasswordPageSeo();
  }

  if (pathname === "/verify-email") {
    return verifyEmailPageSeo();
  }

  if (pathname === "/agents") {
    const highlight =
      typeof query.highlight === "string"
        ? query.highlight
        : typeof query.agentId === "string"
          ? query.agentId
          : undefined;
    return agentsPageSeo(highlight);
  }

  if (pathname === "/agents/[agentId]/runs/[runId]") {
    const agentId = typeof query.agentId === "string" ? query.agentId : "";
    const runId = typeof query.runId === "string" ? query.runId : "";
    const agentName = typeof query.agentName === "string" ? query.agentName : undefined;
    return agentsRunDetailSeo(agentId, runId, agentName);
  }

  if (pathname === "/dashboard") {
    return dashboardPageSeo();
  }

  if (isPrivateAppRoute(pathname)) {
    return {
      title: "Workspace",
      path,
      ogType: "site",
      noIndex: true,
    };
  }

  return {
    path: path === "" ? "/" : path,
    ogType: "site",
  };
}
