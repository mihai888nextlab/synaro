import type { NextApiRequest, NextApiResponse } from "next";

import { createProjectForUser } from "@/lib/mcp-deploy";
import { requirePublicApiAuth } from "@/lib/public-api-auth";
import { requireMethod } from "@/lib/public-api/method";
import { serializeProject } from "@/lib/public-api/serialize";
import { getUserProjectCardsWithRows } from "@/lib/user-project-cards";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET", "POST"])) return;

  const auth = await requirePublicApiAuth(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { rows } = await getUserProjectCardsWithRows(auth.userId);
    return res.status(200).json({ projects: rows.map(serializeProject) });
  }

  if (req.method === "POST") {
    const body = req.body as {
      name?: unknown;
      description?: unknown;
      repository_url?: unknown;
      docker_image?: unknown;
    };

    try {
      const { project, environmentWarning } = await createProjectForUser(auth.userId, {
        name: typeof body.name === "string" ? body.name : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        repositoryUrl: typeof body.repository_url === "string" ? body.repository_url : undefined,
        dockerImage: typeof body.docker_image === "string" ? body.docker_image : undefined,
      });

      return res.status(201).json({
        ...serializeProject(project),
        environment_warning: environmentWarning ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: msg });
    }
  }

  return res.status(405).json({ error: "method_not_allowed" });
}
