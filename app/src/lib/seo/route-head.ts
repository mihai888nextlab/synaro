import type { SynaroPageHeadProps } from "@/components/seo/synaro-page-head";
import { DEFAULT_DOC_SLUG } from "@/lib/documentation";
import {
  agentsPageSeo,
  dashboardPageSeo,
  docPageSeo,
  homePageSeo,
  loginPageSeo,
  pricingPageSeo,
  projectWorkspaceSeo,
  signupPageSeo,
} from "@/lib/seo/page-seo";

const PRIVATE_ROUTE_PREFIXES = ["/dashboard", "/settings", "/logs", "/projects", "/agents"];

function isPrivateAppRoute(pathname: string): boolean {
  if (pathname === "/projects/invite/[token]") return false;
  if (pathname === "/p/[projectSlug]") return false;
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

  if (pathname === "/agents") {
    const highlight =
      typeof query.highlight === "string"
        ? query.highlight
        : typeof query.agentId === "string"
          ? query.agentId
          : undefined;
    return agentsPageSeo(highlight);
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
