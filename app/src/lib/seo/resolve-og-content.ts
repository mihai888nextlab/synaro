import { DEFAULT_LOCALE } from "@/i18n/config";
import { getDocPage } from "@/lib/documentation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo/site-metadata";

export type OgCardContent = {
  title: string;
  subtitle: string;
  badge: string;
  accentLabel: string;
};

const SITE_CARD: OgCardContent = {
  title: "Idea to running software",
  subtitle: DEFAULT_DESCRIPTION,
  badge: "Open",
  accentLabel: "S",
};

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function firstInitial(label: string): string {
  const ch = label.trim().charAt(0);
  return ch ? ch.toUpperCase() : "S";
}

function agentServiceConfig(): { baseUrl: string; serviceKey: string } {
  return {
    baseUrl: process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007",
    serviceKey: process.env.AGENT_SERVICE_KEY?.trim() ?? "",
  };
}

export async function resolveOgContent(
  type: string,
  query: Record<string, string | string[] | undefined>,
): Promise<OgCardContent | null> {
  switch (type) {
    case "site":
      return SITE_CARD;

    case "doc": {
      const slug = typeof query.slug === "string" ? query.slug : "";
      const page = getDocPage(slug || undefined, DEFAULT_LOCALE);
      if (!page) return null;
      return {
        title: truncate(page.title, 72),
        subtitle: truncate(page.description, 120),
        badge: "Docs",
        accentLabel: firstInitial(page.title),
      };
    }

    case "project": {
      const slug = typeof query.slug === "string" ? query.slug.trim() : "";
      if (!slug) return null;
      const project = await prisma.project.findUnique({
        where: { slug },
        select: { name: true, description: true },
      });
      if (!project) return null;
      return {
        title: truncate(project.name, 72),
        subtitle: truncate(project.description?.trim() || "Developer workspace on Synaro", 120),
        badge: "Project",
        accentLabel: firstInitial(project.name),
      };
    }

    case "invite": {
      const token = typeof query.token === "string" ? query.token.trim() : "";
      if (!token) return null;
      const invite = await prisma.projectInvite.findFirst({
        where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
        include: { project: { select: { name: true, description: true } } },
      });
      if (!invite) return null;
      return {
        title: truncate(`Join ${invite.project.name}`, 72),
        subtitle: truncate(
          invite.project.description?.trim() || "Collaborate on a Synaro project",
          120,
        ),
        badge: "Invite",
        accentLabel: firstInitial(invite.project.name),
      };
    }

    case "agent": {
      const id = typeof query.id === "string" ? query.id.trim() : "";
      if (!id) return null;
      const { baseUrl, serviceKey } = agentServiceConfig();
      try {
        const res = await fetch(`${baseUrl}/api/agents/${encodeURIComponent(id)}`, {
          headers: {
            "Content-Type": "application/json",
            "X-Service-Key": serviceKey,
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const agent = (await res.json()) as { name?: string; description?: string | null };
        const name = agent.name?.trim();
        if (!name) return null;
        return {
          title: truncate(name, 72),
          subtitle: truncate(agent.description?.trim() || "Autonomous agent on Synaro", 120),
          badge: "Agent",
          accentLabel: firstInitial(name),
        };
      } catch {
        return null;
      }
    }

    default:
      return null;
  }
}

export function fallbackOgContent(): OgCardContent {
  return { ...SITE_CARD, badge: SITE_NAME };
}
