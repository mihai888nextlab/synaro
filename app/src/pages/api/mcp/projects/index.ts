import type { NextApiRequest, NextApiResponse } from "next";

import { requireMcpApiAuth } from "@/lib/mcp-api-auth";
import { createProjectForUser } from "@/lib/mcp-deploy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = requireMcpApiAuth(req, res);
  if (!userId) return;

  const body = req.body as {
    name?: unknown;
    description?: unknown;
    repository_url?: unknown;
    docker_image?: unknown;
  };

  try {
    const { project, environmentWarning } = await createProjectForUser(userId, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      repositoryUrl: typeof body.repository_url === "string" ? body.repository_url : undefined,
      dockerImage: typeof body.docker_image === "string" ? body.docker_image : undefined,
    });

    return res.status(201).json({
      project_id: project.id,
      slug: project.slug,
      name: project.name,
      environment_status: project.environmentStatus,
      environment_warning: environmentWarning ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: msg });
  }
}
