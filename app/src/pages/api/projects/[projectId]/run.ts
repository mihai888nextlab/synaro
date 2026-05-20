import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/next-auth-options";
import { prisma } from "@/lib/prisma";
import { whereProjectByIdForUser } from "@/lib/project-access";
import {
  fetchEnvironmentsForProject,
  pickActiveRuntimeEnvironment,
  remoteExecTerminal,
  remoteWorkspaceSelection,
} from "@/lib/environment-service-api";

type PackageJson = {
  scripts?: Record<string, string>;
  main?: string;
};

function detectRunCommand(pkg: PackageJson | null): string {
  if (!pkg) return "node index.js";
  const scripts = pkg.scripts ?? {};
  if (scripts.start) return "npm start";
  if (scripts.dev) return "npm run dev";
  if (scripts.serve) return "npm run serve";
  if (pkg.main) return `node ${pkg.main}`;
  return "node index.js";
}

// Port 3000 in hex = 0xBB8. /proc/net/tcp lists listening ports as ":0BB8 "
const PORT_CHECK_CMD =
  "grep -q ':0BB8 ' /proc/net/tcp /proc/net/tcp6 2>/dev/null && echo SYNARO_READY || echo SYNARO_WAIT";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const raw = req.query.projectId;
  const projectId = typeof raw === "string" ? raw : "";
  if (!projectId) return res.status(400).json({ error: "Missing projectId" });

  const project = await prisma.project.findFirst({
    where: whereProjectByIdForUser(projectId, session.user.id),
    select: { id: true },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });

  // Get active environment
  const envs = await fetchEnvironmentsForProject(projectId).catch(() => []);
  const env = pickActiveRuntimeEnvironment(envs);
  if (!env) return res.status(400).json({ error: "No running environment. Start the runtime first." });
  const previewUrl = env.publicUrl ?? (env.port ? `http://localhost:${env.port}` : null);
  if (!previewUrl) return res.status(400).json({ error: "Environment has no port or public URL assigned." });

  if (req.method === "GET") {
    const action = typeof req.query.action === "string" ? req.query.action : null;

    // ?action=logs — return last 150 lines of /tmp/app.log
    if (action === "logs") {
      try {
        const result = await remoteExecTerminal(
          env.id,
          "tail -n 150 /tmp/app.log 2>/dev/null || echo '(no logs yet)'",
        );
        const lines = result.output.split("\n");
        return res.json({ lines });
      } catch {
        return res.json({ lines: ["(could not fetch logs)"] });
      }
    }

    // Default GET — check if port 3000 is listening inside the container
    try {
      const result = await remoteExecTerminal(env.id, PORT_CHECK_CMD);
      const ready = result.output.includes("SYNARO_READY");
      return res.json({ ready, previewUrl });
    } catch {
      return res.json({ ready: false, previewUrl });
    }
  }

  // POST — start the app
  if (req.method === "POST") {
    let pkg: PackageJson | null = null;
    try {
      const sel = await remoteWorkspaceSelection(env.id, "package.json");
      if (sel.kind === "file" && sel.content) {
        pkg = JSON.parse(sel.content) as PackageJson;
      }
    } catch {
      pkg = null;
    }

    const runCommand = detectRunCommand(pkg);
    const hasPackageJson = pkg !== null;

    const installStep = hasPackageJson
      ? '([ -d node_modules ] || (echo "[synaro] Installing dependencies..." >> /tmp/app.log && npm install --loglevel=warn >> /tmp/app.log 2>&1)) && '
      : "";

    // Kill any process using port 3000 via inode lookup (/proc/net).
    // fuser is unreliable in Docker, and pkill -f matches the script itself.
    const killPort3000 = [
      'INODE=$(awk "NR>1 && \\$2 ~ /:0BB8/ {print \\$10}" /proc/net/tcp /proc/net/tcp6 2>/dev/null | head -1)',
      'if [ -n "$INODE" ]; then',
      '  for piddir in /proc/[0-9]*/fd; do',
      '    if ls -la "$piddir" 2>/dev/null | grep -q "socket:\\[$INODE\\]"; then',
      '      PID=${piddir%/fd}; PID=${PID#/proc/}',
      '      kill -9 "$PID" 2>/dev/null || true',
      '    fi',
      '  done',
      'fi',
    ].join("\n");

    // Use newlines — busybox sh rejects `&;` (ampersand followed by semicolon).
    const bgScript = [
      "rm -f /tmp/app.log",
      killPort3000,
      `(cd /tmp/synaro-workspace/app 2>/dev/null || cd /tmp/synaro-workspace 2>/dev/null; ${installStep}echo "[synaro] Starting: ${runCommand}" >> /tmp/app.log && PORT=3000 ${runCommand} >> /tmp/app.log 2>&1) &`,
      "APP_PID=$!",
      "echo $APP_PID > /tmp/app.pid",
      'echo "SYNARO_PID:$APP_PID"',
    ].join("\n");

    try {
      await remoteExecTerminal(env.id, bgScript);
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }

    return res.json({
      previewUrl,
      command: runCommand,
      installing: hasPackageJson,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
