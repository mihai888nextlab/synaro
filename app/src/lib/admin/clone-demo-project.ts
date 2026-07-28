import { allocateUniqueProjectSlug } from "@/lib/allocate-project-slug";
import { environmentServiceBaseUrl } from "@/lib/provision-project-environment";
import { prisma } from "@/lib/prisma";

function aiServiceBaseUrl(): string {
  return process.env.AI_SERVICE_URL?.trim() || "http://localhost:3003";
}
function agentServiceUrl(): string {
  return process.env.AGENT_SERVICE_URL?.trim() || "http://localhost:3007";
}
function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Copy the source project's workspace volume into the new project's (files, no container needed). */
async function cloneWorkspaceVolume(fromProjectId: string, toProjectId: string): Promise<void> {
  const res = await fetch(`${environmentServiceBaseUrl()}/api/environments/clone-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromProjectId, toProjectId }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error((await res.text().catch(() => "")) || `clone-workspace failed (${res.status})`);
  }
}

/** Copy the source project's AI chat history (Task rows) to the new project. Returns rows copied. */
async function cloneChatHistory(fromProjectId: string, toProjectId: string): Promise<number> {
  const res = await fetch(`${aiServiceBaseUrl()}/api/tasks/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromProjectId, toProjectId }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `tasks/clone failed (${res.status})`);
  const data = (await res.json().catch(() => ({}))) as { cloned?: number };
  return typeof data.cloned === "number" ? data.cloned : 0;
}

/** Copy the source user's agents (+ memory + runs) to the demo user, remapping the cloned project. */
async function cloneAgents(
  fromUserId: string,
  toUserId: string,
  fromProjectId: string,
  toProjectId: string,
): Promise<number> {
  const res = await fetch(`${agentServiceUrl()}/api/agents/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Key": process.env.AGENT_SERVICE_KEY?.trim() ?? "" },
    body: JSON.stringify({ fromUserId, toUserId, fromProjectId, toProjectId }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `agents/clone failed (${res.status})`);
  const data = (await res.json().catch(() => ({}))) as { clonedAgents?: number };
  return typeof data.clonedAgents === "number" ? data.clonedAgents : 0;
}

export type CloneDemoResult = {
  projectId: string;
  slug: string;
  name: string;
  chatCloned: number;
  agentsCloned: number;
  warnings: string[];
};

/**
 * Seed a demo account: create a project owned by the target user with the SAME files (own volume),
 * the SAME AI chat history, and the SAME agents. The container is NOT started here — the admin
 * dashboard starts it on demand (Start provisions an env that mounts the pre-filled volume).
 */
export async function cloneDemoProject(args: {
  sourceProjectId: string;
  targetUserId: string;
  cloneAgents?: boolean;
}): Promise<CloneDemoResult> {
  const source = await prisma.project.findUnique({ where: { id: args.sourceProjectId } });
  if (!source) throw new Error("Source project not found");

  const slug = await allocateUniqueProjectSlug(prisma, `${source.name} demo`);
  const target = await prisma.project.create({
    data: {
      slug,
      name: source.name,
      description: source.description,
      userId: args.targetUserId,
      environmentStatus: "INACTIVE",
      cloneRepositoryUrl: null,
    },
  });

  const warnings: string[] = [];
  let chatCloned = 0;
  let agentsCloned = 0;

  // Files — copy the workspace volume. Without this the demo project is empty.
  try {
    await cloneWorkspaceVolume(source.id, target.id);
  } catch (e) {
    warnings.push(`File copy failed: ${msg(e)}`);
  }

  // Chat history.
  try {
    chatCloned = await cloneChatHistory(source.id, target.id);
  } catch (e) {
    warnings.push(`Chat history copy failed: ${msg(e)}`);
  }

  // Agents (optional).
  if (args.cloneAgents !== false) {
    try {
      agentsCloned = await cloneAgents(source.userId, args.targetUserId, source.id, target.id);
    } catch (e) {
      warnings.push(`Agent copy failed: ${msg(e)}`);
    }
  }

  return { projectId: target.id, slug, name: target.name, chatCloned, agentsCloned, warnings };
}
