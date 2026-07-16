import type { DocNavGroup, DocPage } from "./types";
export { DEFAULT_DOC_SLUG } from "./types";

export const DOC_NAV: DocNavGroup[] = [
  {
    title: "Introduction",
    items: [
      { slug: "what-is-synaro", label: "What is Synaro?" },
      { slug: "getting-started", label: "Getting started" },
    ],
  },
  {
    title: "Platform",
    items: [
      { slug: "projects", label: "Projects" },
      { slug: "environments", label: "Environments & Docker" },
      { slug: "workspace", label: "Project workspace" },
      { slug: "ai-tasks", label: "AI task engine" },
    ],
  },
  {
    title: "AI Agents",
    items: [
      { slug: "ai-agents", label: "AI agents" },
      { slug: "agent-tools", label: "Tools & runs" },
    ],
  },
  {
    title: "Public API",
    items: [
      { slug: "public-api", label: "Overview & authentication" },
      { slug: "public-api-projects", label: "Projects & environments" },
      { slug: "public-api-tasks", label: "AI tasks" },
      { slug: "public-api-agents", label: "Agents" },
      { slug: "public-api-sdk", label: "TypeScript SDK" },
    ],
  },
  {
    title: "Developers",
    items: [
      { slug: "architecture", label: "Architecture" },
      { slug: "tech-stack", label: "Tech stack" },
      { slug: "services", label: "Services & APIs" },
      { slug: "local-development", label: "Local development" },
    ],
  },
  {
    title: "Operations",
    items: [
      { slug: "security", label: "Security" },
      { slug: "roadmap", label: "Roadmap" },
    ],
  },
];

export const DOC_PAGES: Record<string, DocPage> = {
  "what-is-synaro": {
    slug: "what-is-synaro",
    title: "What is Synaro?",
    description:
      "Synaro turns plain-language ideas into containerized, runnable software—with AI scaffolding, isolated environments, and a unified control plane.",
    blocks: [
      {
        type: "p",
        text: "Synaro is a developer infrastructure platform. Describe what you want to build; Synaro scaffolds the repository, provisions a Docker workspace, and lets you iterate with AI-assisted tasks—from a single dashboard.",
      },
      {
        type: "p",
        text: "Each project gets its own slugged workspace with a file tree, in-browser terminal, live preview, and an AI chat that can analyze your repo, ask clarifying questions, and apply code changes safely.",
      },
      {
        type: "callout",
        variant: "tip",
        title: "Who is it for?",
        text: "Teams and individuals who want fast feedback loops: prototype in minutes, share previews, and keep environments isolated without managing raw cloud consoles for every experiment.",
      },
      {
        type: "h2",
        text: "What you can do",
      },
      {
        type: "ul",
        items: [
          "Create projects from a prompt, GitHub import, or local folder upload",
          "Run and stop containerized dev environments per project",
          "Browse files, open a web terminal, preview running apps, and download the workspace as a zip",
          "Run AI tasks in project chat that generate, validate, and apply repository changes",
          "Create standalone AI agents with web search and HTTP tools for research and scheduled tasks",
          "Invite collaborators and track platform activity in logs",
          "Automate projects, deploys, and agents via the Public API (/api/v1) with API keys",
        ],
      },
    ],
  },
  "getting-started": {
    slug: "getting-started",
    title: "Getting started",
    description: "Create an account, spin up your first project, and open the workspace.",
    blocks: [
      {
        type: "h2",
        text: "1. Sign up",
      },
      {
        type: "p",
        text: "Visit the Synaro app and create an account with email/password or link GitHub via NextAuth. After sign-in you land on the dashboard with KPIs, recent projects, and activity logs.",
      },
      {
        type: "h2",
        text: "2. Create a project",
      },
      {
        type: "p",
        text: "From Projects, choose Create to scaffold from a description, Import to clone a GitHub repository, or upload a local folder. Each project receives a unique slug used in URLs (/projects/your-slug).",
      },
      {
        type: "h2",
        text: "3. Start the environment",
      },
      {
        type: "p",
        text: "Open the project workspace and use the Docker control (running / stopped pill) to provision a container. When the environment is RUNNING, use Run to start your app process and open the preview panel.",
      },
      {
        type: "h2",
        text: "4. Iterate with AI",
      },
      {
        type: "p",
        text: "Switch to the AI chat tab, describe a change, answer any clarification questions, and submit. The orchestration service tracks task status (analyzing → generating → applying) until changes land in your tree.",
      },
      {
        type: "code",
        title: "Example prompt",
        code: 'Add a health check route at GET /api/health that returns { "ok": true }.',
      },
      {
        type: "h2",
        text: "5. Try AI agents (optional)",
      },
      {
        type: "p",
        text: "Open Agents from the dashboard sidebar. Create an agent with a system prompt and one or more tools (web search, HTTP GET/POST), then run it on demand or attach a cron schedule for recurring research tasks. Agents do not require a running project environment.",
      },
      {
        type: "h2",
        text: "6. Automate with the Public API (optional)",
      },
      {
        type: "p",
        text: "For scripts and CI, go to Settings → API keys, create a key, and call /api/v1 with Authorization: Bearer <key>. Start with GET /api/v1/me. Prefer the typed TypeScript SDK (@synaro/sdk) — see /documentation/public-api-sdk — or the raw HTTP pages under Public API for projects, tasks, and agents.",
      },
    ],
  },
  projects: {
    slug: "projects",
    title: "Projects",
    description: "Lifecycle, metadata, imports, sharing, and how projects map to services.",
    blocks: [
      {
        type: "p",
        text: "A project is the top-level unit in Synaro. It stores name, slug, description, optional Git remote URL, Docker base image selection, and environment status synchronized from the environment service.",
      },
      {
        type: "h2",
        text: "Creation flows",
      },
      {
        type: "ul",
        items: [
          "Blank / prompt — AI-assisted scaffold with chosen runtime image (Node, Python, Go, Nginx, Ubuntu, or automatic detection)",
          "GitHub import — clone repository into the workspace volume on provision",
          "Folder upload — import files without Git history (no commit metadata in the file tree)",
        ],
      },
      {
        type: "h2",
        text: "Collaboration",
      },
      {
        type: "p",
        text: "Project owners can invite members via share links (project invites with expiring tokens). Members get workspace access; owners retain delete and invite management.",
      },
      {
        type: "h2",
        text: "Data stores",
      },
      {
        type: "p",
        text: "Project metadata lives in the main app database (Prisma on PostgreSQL). The project-service maintains its own schema for service-specific records. Environment runtime state is stored separately in the environment-service database.",
      },
    ],
  },
  environments: {
    slug: "environments",
    title: "Environments & Docker",
    description: "How Synaro provisions containers, exposes previews, and manages runtime state.",
    blocks: [
      {
        type: "p",
        text: "The environment-service talks to the local Docker socket (or cluster runtime in production) to create isolated workspaces per project. Status flows back to the UI as INACTIVE, PROVISIONING, RUNNING, STOPPED, or ERROR.",
      },
      {
        type: "h2",
        text: "Lifecycle",
      },
      {
        type: "ol",
        items: [
          "User starts Docker from the workspace toolbar",
          "Service clones or mounts the project workspace and selects a base image",
          "Container runs with CPU/memory limits and network policy",
          "Terminal WebSocket attaches for interactive shells",
          "Stop or destroy releases resources",
        ],
      },
      {
        type: "h2",
        text: "Preview & run",
      },
      {
        type: "p",
        text: "When RUNNING, the Run control executes your start command and streams logs into the workspace log panel. The preview iframe loads the published preview URL (often localhost ports forwarded from the container).",
      },
      {
        type: "callout",
        variant: "info",
        text: "Many third-party sites block iframe embedding (X-Frame-Options). Use URLs you control for reliable previews.",
      },
    ],
  },
  workspace: {
    slug: "workspace",
    title: "Project workspace",
    description: "File tree, terminal, AI chat, preview, and persisted UI state.",
    blocks: [
      {
        type: "p",
        text: "The workspace at /projects/[slug] is the operational heart of Synaro. It combines three primary tabs with a live preview column on wide screens.",
      },
      {
        type: "table",
        headers: ["Tab", "Purpose"],
        rows: [
          ["File tree", "Browse repository files, search, and inspect selection metadata (commits when Git is present)"],
          ["AI chat", "Natural-language tasks with clarification, voice input (Web Speech API), markdown responses, and auto-apply on completion"],
          ["Terminal", "xterm.js session into the running container when the environment is active"],
        ],
      },
      {
        type: "h2",
        text: "Client persistence",
      },
      {
        type: "p",
        text: "Expanded folders, last selected file, and active tab are stored in localStorage per project so returning to a workspace restores your context without a full reload.",
      },
      {
        type: "h2",
        text: "Workspace download",
      },
      {
        type: "p",
        text: "When the environment is active, download the full workspace tree as a zip archive from the workspace toolbar. The app proxies the archive from the environment service so you can back up or share files outside Synaro.",
      },
    ],
  },
  "ai-tasks": {
    slug: "ai-tasks",
    title: "AI task engine",
    description: "Clarification, orchestration, Moonshot/Kimi integration, and task statuses.",
    blocks: [
      {
        type: "p",
        text: "AI work is asynchronous. The app calls the ai-orchestration-service, which may ask follow-up questions, then runs ANALYZING → GENERATING → APPLYING before marking DONE or FAILED.",
      },
      {
        type: "h2",
        text: "Flow",
      },
      {
        type: "ol",
        items: [
          "User sends a prompt from AI chat (optionally after voice capture)",
          "App may call /api/projects/[id]/ai-clarify for structured questions",
          "Submission creates a task polled via /api/ai-tasks/[taskId]",
          "Orchestrator reads the workspace via environment-service and writes file patches",
          "UI shows progress, resulting paths, and errors inline in the thread as markdown",
        ],
      },
      {
        type: "h2",
        text: "Configuration",
      },
      {
        type: "p",
        text: "Set KIMI_API_KEY (Moonshot) in the orchestration service environment. Without a valid key, tasks fail with authentication errors from the provider.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Not the same as AI agents",
        text: "Project AI tasks modify your repository inside a Docker workspace. Standalone agents at /agents run separately with web and HTTP tools—see the AI Agents section for that feature.",
      },
    ],
  },
  "ai-agents": {
    slug: "ai-agents",
    title: "AI agents",
    description:
      "User-scoped agents for research, HTTP calls, and scheduled tasks—separate from project chat.",
    blocks: [
      {
        type: "p",
        text: "AI agents live on the Agents page (/agents) in the dashboard. Each agent has a name, system prompt, selected tools, and optional cron schedule. Agents run in the background via a dedicated ReAct loop and do not need a project container or file tree.",
      },
      {
        type: "callout",
        variant: "tip",
        title: "When to use agents vs project AI chat",
        text: "Use project AI chat when you want code written into your repo. Use standalone agents for longer research, API calls, or recurring tasks that produce a text answer rather than file patches.",
      },
      {
        type: "h2",
        text: "Creating an agent",
      },
      {
        type: "ol",
        items: [
          "Open Agents from the dashboard sidebar and click + New agent",
          "Enter a name, optional description, and system prompt that defines the agent's role",
          "Toggle tools: Web Search, HTTP GET, and/or HTTP POST",
          "Set max steps (1–50, default 20) to cap how many reasoning iterations the runner allows",
          "Optionally add a cron expression (e.g. */30 * * * *) for automatic runs",
        ],
      },
      {
        type: "h2",
        text: "Agent card actions",
      },
      {
        type: "table",
        headers: ["Action", "Purpose"],
        rows: [
          ["Run", "Start a manual run with optional input text"],
          ["runs →", "Open run history; click a run for the live step trace"],
          ["Edit", "Update name, prompt, tools, max steps, and schedule"],
          ["Enable toggle", "Disable agents to block manual and cron runs"],
          ["Delete", "Remove the agent and all associated runs"],
        ],
      },
      {
        type: "h2",
        text: "Run detail page",
      },
      {
        type: "p",
        text: "Each run opens at /agents/{agentId}/runs/{runId} with a live ReAct step timeline while status is PENDING or RUNNING (polls every 2 seconds), plus input and markdown output when available.",
      },
      {
        type: "h2",
        text: "Architecture",
      },
      {
        type: "p",
        text: "The Next.js app proxies session-authenticated requests to agent-service (port 3007), which stores agents and runs in PostgreSQL. On trigger, agent-service creates a run and notifies agent-runner (port 3008), which executes the ReAct loop with Kimi K2.6 and reports completion via webhook.",
      },
    ],
  },
  "agent-tools": {
    slug: "agent-tools",
    title: "Tools & runs",
    description: "Available tools, run lifecycle, scheduling, and environment requirements.",
    blocks: [
      {
        type: "p",
        text: "Each agent only receives the tools you enable at creation time. The runner passes them to the LLM as function calls; observations are fed back until the model finishes or max steps is reached.",
      },
      {
        type: "h2",
        text: "Tools",
      },
      {
        type: "table",
        headers: ["Tool", "What it does"],
        rows: [
          ["web_search", "Queries the web via Brave Search API; returns top results as context"],
          ["http_get", "Fetches a public URL (SSRF-protected, size-capped)"],
          ["http_post", "Sends a JSON POST to a public URL with the same safety limits"],
        ],
      },
      {
        type: "h2",
        text: "Run lifecycle",
      },
      {
        type: "ol",
        items: [
          "Trigger creates a run in PENDING status and returns immediately (async)",
          "agent-runner sets RUNNING and enters the ReAct loop",
          "Each step: Kimi may call tools or return a final answer",
          "On completion the runner posts to agent-service; status becomes DONE or FAILED",
          "The runs dialog polls every few seconds while any run is still active",
        ],
      },
      {
        type: "h2",
        text: "Run statuses",
      },
      {
        type: "table",
        headers: ["Status", "Meaning"],
        rows: [
          ["PENDING", "Queued, waiting for the runner to pick up"],
          ["RUNNING", "ReAct loop in progress"],
          ["DONE", "Final output available in the runs list"],
          ["FAILED", "Error or max steps reached without a finish"],
        ],
      },
      {
        type: "h2",
        text: "Configuration",
      },
      {
        type: "p",
        text: "agent-runner requires KIMI_API_KEY for the LLM and BRAVE_SEARCH_API_KEY when web_search is enabled. Set AGENT_SERVICE_KEY consistently across the app, agent-service, and agent-runner for service-to-service auth.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Cron jobs register when agent-runner starts. After creating or changing schedules, restart the runner container so new cron expressions take effect.",
      },
    ],
  },
  "public-api": {
    slug: "public-api",
    title: "Public API — overview",
    description:
      "Programmatic access to Synaro via /api/v1 with per-user API keys, Bearer authentication, and snake_case JSON.",
    blocks: [
      {
        type: "p",
        text: "The Synaro Public API lets you manage projects, environments, AI tasks, and standalone agents from scripts, CI pipelines, or your own integrations. All endpoints live under /api/v1 on the same host as the web app (for example https://app.synaro.com/api/v1 or http://localhost:3000/api/v1 locally).",
      },
      {
        type: "callout",
        variant: "tip",
        title: "Official SDK",
        text: "Prefer the TypeScript package @synaro/sdk for typed helpers (deploy wait, task/run polling, memory, cancel, CLI). Full guide: /documentation/public-api-sdk. OpenAPI lives at packages/sdk/openapi/v1.yaml in the repository.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Not the dashboard session API",
        text: "Routes like /api/projects and /api/agents require a browser NextAuth session. The public API uses API keys instead and is the supported surface for automation. Internal microservices are never exposed directly.",
      },
      {
        type: "h2",
        text: "Quick start",
      },
      {
        type: "ol",
        items: [
          "Sign in to Synaro and open Settings → API keys (/settings/api-keys)",
          "Create a key, copy the secret immediately (it is shown only once)",
          "Send Authorization: Bearer <your_key> on every /api/v1 request",
          "Call GET /api/v1/me to verify the key works",
        ],
      },
      {
        type: "code",
        title: "Verify your key",
        code: `curl -s \\
  -H "Authorization: Bearer sk_live_YOUR_KEY" \\
  https://YOUR_SYNARO_HOST/api/v1/me`,
      },
      {
        type: "h2",
        text: "Authentication",
      },
      {
        type: "p",
        text: "Every /api/v1 request must include an Authorization header with a Bearer token. Keys use the sk_live_ prefix followed by a random secret. Only a SHA-256 hash is stored server-side; if you lose the secret, revoke the key and create a new one.",
      },
      {
        type: "table",
        headers: ["Header", "Value"],
        rows: [
          ["Authorization", "Bearer sk_live_…"],
          ["Content-Type", "application/json (for POST/PATCH bodies)"],
        ],
      },
      {
        type: "p",
        text: "API keys are created and revoked from the dashboard (session auth). There is no public endpoint to mint keys—only to use them.",
      },
      {
        type: "h2",
        text: "Conventions",
      },
      {
        type: "ul",
        items: [
          "JSON field names use snake_case for projects, tasks, deploy, and most responses",
          "Agent create/update bodies prefer camelCase (systemPrompt, toolMode, maxSteps, mcpServers); snake_case aliases are accepted and normalized",
          "Project identifiers in URLs are UUIDs (project_id), not slugs",
          "Errors return JSON with an error field; many responses also include detail",
          "Collaborators with project access can use the same endpoints as the owner",
          "HTTP 401 means missing or invalid API key; 404 usually means the resource is missing or not visible to your user",
          "HTTP 429 means rate limit exceeded — default is 120 requests per 60 seconds per API key (SYNARO_API_RATE_LIMIT and SYNARO_API_RATE_WINDOW_SEC)",
          "Responses include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset; 429 responses also include Retry-After",
        ],
      },
      {
        type: "h2",
        text: "Endpoint map",
      },
      {
        type: "table",
        headers: ["Area", "Base path", "Doc page"],
        rows: [
          ["Account & health", "GET /api/v1/me, GET /api/v1/status", "This page"],
          ["Projects", "/api/v1/projects…", "Projects & environments"],
          ["Project AI tasks", "/api/v1/projects/:id/tasks, /api/v1/tasks/:id", "AI tasks"],
          ["Standalone agents", "/api/v1/agents…, /api/v1/runs/:id", "Agents"],
          ["TypeScript SDK", "@synaro/sdk + synaro CLI", "TypeScript SDK"],
        ],
      },
      {
        type: "h2",
        text: "Account & platform status",
      },
      {
        type: "h3",
        text: "GET /api/v1/me",
      },
      {
        type: "p",
        text: "Returns the user tied to the API key.",
      },
      {
        type: "code",
        title: "Response (200)",
        code: `{
  "user_id": "uuid",
  "email": "you@example.com",
  "name": "Your Name",
  "created_at": "2026-01-15T10:00:00.000Z"
}`,
      },
      {
        type: "h3",
        text: "GET /api/v1/status",
      },
      {
        type: "p",
        text: "Reports platform health (app database, environment-service, ai-orchestration-service). Optionally pass project_id as a query parameter to include that project's environment status and whether port 3000 inside the container is accepting connections.",
      },
      {
        type: "code",
        title: "Example",
        code: `curl -s -H "Authorization: Bearer sk_live_…" \\
  "https://YOUR_HOST/api/v1/status?project_id=PROJECT_UUID"`,
      },
      {
        type: "callout",
        variant: "tip",
        text: "Use /api/v1/status in health checks or before deploy scripts to confirm dependent services are reachable.",
      },
    ],
  },
  "public-api-projects": {
    slug: "public-api-projects",
    title: "Public API — projects & environments",
    description:
      "Create and list projects, start/stop Docker environments, deploy apps, and read runtime logs.",
    blocks: [
      {
        type: "p",
        text: "Projects are the top-level unit in Synaro. Each has a UUID (project_id), a URL slug for the dashboard, and an isolated Docker workspace. These endpoints mirror what you can do from the Projects page and workspace toolbar.",
      },
      {
        type: "callout",
        variant: "tip",
        title: "Prefer the SDK",
        text: "For typed deploy helpers (waitUntilReady, ensureRunning, withPreview), use @synaro/sdk — see /documentation/public-api-sdk.",
      },
      {
        type: "h2",
        text: "List projects",
      },
      {
        type: "h3",
        text: "GET /api/v1/projects",
      },
      {
        type: "code",
        title: "Response (200)",
        code: `{
  "projects": [
    {
      "project_id": "uuid",
      "slug": "my-app",
      "name": "My App",
      "description": null,
      "environment_status": "RUNNING",
      "repository_location": "http://localhost:32847",
      "clone_repository_url": "https://github.com/org/repo",
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-16T08:30:00.000Z"
    }
  ]
}`,
      },
      {
        type: "h2",
        text: "Create a project",
      },
      {
        type: "h3",
        text: "POST /api/v1/projects",
      },
      {
        type: "table",
        headers: ["Field", "Type", "Required", "Description"],
        rows: [
          ["name", "string", "Yes*", "Display name (max 120 chars). *Derived from repository_url if omitted when importing GitHub."],
          ["description", "string", "No", "Optional description (max 2000 chars)"],
          ["repository_url", "string", "No", "GitHub HTTPS URL (https://github.com/owner/repo) to clone on provision"],
          ["docker_image", "string", "No", "Base image hint (e.g. node:20-alpine); defaults to automatic selection"],
        ],
      },
      {
        type: "code",
        title: "Request",
        code: `curl -s -X POST \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Demo API","repository_url":"https://github.com/org/repo"}' \\
  https://YOUR_HOST/api/v1/projects`,
      },
      {
        type: "p",
        text: "Returns 201 with the project object. If environment provisioning fails, environment_warning contains a human-readable message and environment_status may be ERROR.",
      },
      {
        type: "h2",
        text: "Get or delete a project",
      },
      {
        type: "h3",
        text: "GET /api/v1/projects/:projectId",
      },
      {
        type: "p",
        text: "Returns a single project object (same shape as list items).",
      },
      {
        type: "h3",
        text: "DELETE /api/v1/projects/:projectId",
      },
      {
        type: "p",
        text: "Destroys remote environments for the project and deletes the database row. Returns 204 with no body.",
      },
      {
        type: "h2",
        text: "Environment lifecycle",
      },
      {
        type: "p",
        text: "Start provisions or resumes the Docker workspace; stop halts the running container. environment_status in responses reflects INACTIVE, PROVISIONING, RUNNING, STOPPED, or ERROR.",
      },
      {
        type: "table",
        headers: ["Endpoint", "Method", "Description"],
        rows: [
          ["/api/v1/projects/:projectId/environment/start", "POST", "Create, resume, or ensure a running environment"],
          ["/api/v1/projects/:projectId/environment/stop", "POST", "Stop the active environment"],
        ],
      },
      {
        type: "code",
        title: "Start response (200)",
        code: `{
  "environment_status": "RUNNING",
  "preview_url": "http://localhost:32847",
  "repository_location": "http://localhost:32847"
}`,
      },
      {
        type: "callout",
        variant: "info",
        text: "If an environment is already PROVISIONING, start may return 409 with a message to wait. GitHub clone on first provision uses the project owner's linked GitHub token when repository_url is set.",
      },
      {
        type: "h2",
        text: "Deploy (run the app)",
      },
      {
        type: "h3",
        text: "POST /api/v1/projects/:projectId/deploy",
      },
      {
        type: "p",
        text: "Ensures the environment is running, detects package.json scripts, installs dependencies if needed, and starts the app process (typically on port 3000 inside the container).",
      },
      {
        type: "table",
        headers: ["Field", "Type", "Default", "Description"],
        rows: [
          ["wait_until_ready", "boolean", "true", "Poll until port 3000 accepts connections"],
          ["timeout_seconds", "number", "120", "Max wait when wait_until_ready is true (5–300)"],
        ],
      },
      {
        type: "code",
        title: "Response (200)",
        code: `{
  "environment_status": "RUNNING",
  "run_status": "running",
  "preview_url": "http://localhost:32847",
  "command": "npm run dev"
}`,
      },
      {
        type: "p",
        text: "run_status is starting, running, or not_ready depending on whether the app bound to port 3000 within the timeout.",
      },
      {
        type: "h2",
        text: "Logs",
      },
      {
        type: "h3",
        text: "GET /api/v1/projects/:projectId/logs",
      },
      {
        type: "table",
        headers: ["Query", "Default", "Description"],
        rows: [
          ["source", "runtime", "runtime = tail /tmp/app.log in the container; task = AI task stream"],
          ["lines", "150", "Number of log lines for runtime source (1–500)"],
          ["task_id", "—", "Required when source=task"],
        ],
      },
      {
        type: "code",
        title: "Runtime logs",
        code: `curl -s -H "Authorization: Bearer sk_live_…" \\
  "https://YOUR_HOST/api/v1/projects/PROJECT_UUID/logs?lines=100"`,
      },
    ],
  },
  "public-api-tasks": {
    slug: "public-api-tasks",
    title: "Public API — AI tasks",
    description:
      "Run repository-scoped AI work inside a project workspace: create tasks, list history, and poll until completion.",
    blocks: [
      {
        type: "p",
        text: "Project AI tasks are the same engine used in workspace AI chat. They analyze the repo, generate changes, and apply patches inside the Docker environment. Tasks are asynchronous—create with POST, then poll GET /api/v1/tasks/:taskId until status is DONE or FAILED.",
      },
      {
        type: "callout",
        variant: "tip",
        title: "Prefer the SDK",
        text: "Use synaro.tasks.run or tasks.watch from @synaro/sdk instead of hand-rolled polling — see /documentation/public-api-sdk.",
      },
      {
        type: "callout",
        variant: "info",
        title: "Not standalone agents",
        text: "These endpoints modify a project repository. For web-search and HTTP-tool agents without a project, use the Agents API pages instead.",
      },
      {
        type: "h2",
        text: "Create a task",
      },
      {
        type: "h3",
        text: "POST /api/v1/projects/:projectId/tasks",
      },
      {
        type: "table",
        headers: ["Field", "Type", "Required", "Description"],
        rows: [
          ["prompt", "string", "Yes", "Natural-language instruction for the AI"],
          ["mode", "string", "No", "generate (default) or answer for Q&A without applying changes"],
        ],
      },
      {
        type: "code",
        title: "Request & response (202)",
        code: `curl -s -X POST \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Add a health check route to the API"}' \\
  https://YOUR_HOST/api/v1/projects/PROJECT_UUID/tasks

# Response:
{
  "task_id": "uuid",
  "status": "PENDING",
  "poll_url": "/api/v1/tasks/uuid"
}`,
      },
      {
        type: "h2",
        text: "List tasks for a project",
      },
      {
        type: "h3",
        text: "GET /api/v1/projects/:projectId/tasks",
      },
      {
        type: "p",
        text: "Returns task history from the ai-orchestration-service. Field names are converted to snake_case in the response.",
      },
      {
        type: "h2",
        text: "Poll task status",
      },
      {
        type: "h3",
        text: "GET /api/v1/tasks/:taskId",
      },
      {
        type: "table",
        headers: ["Query", "Default", "Description"],
        rows: [
          ["wait", "true", "Block until DONE, FAILED, or timeout (set false for a single snapshot)"],
          ["timeout_seconds", "300", "Max wait when wait=true (5–600)"],
        ],
      },
      {
        type: "code",
        title: "Completed task (200)",
        code: `{
  "task_id": "uuid",
  "project_id": "uuid",
  "status": "DONE",
  "progress": null,
  "summary": "Added GET /health returning { ok: true }",
  "changes": [],
  "git": { "html_url": "…", "branch": "main" },
  "meta": { "explored_files": 12, "ai_steps": 4 },
  "error_message": null,
  "stream_content": "…",
  "timed_out": false
}`,
      },
      {
        type: "h2",
        text: "Task statuses",
      },
      {
        type: "table",
        headers: ["Status", "Meaning"],
        rows: [
          ["PENDING", "Queued"],
          ["ANALYZING / GENERATING / APPLYING", "In progress (orchestration phases)"],
          ["DONE", "Finished successfully; summary and changes populated"],
          ["FAILED", "Error; see error_message"],
        ],
      },
      {
        type: "h2",
        text: "Typical automation flow",
      },
      {
        type: "ol",
        items: [
          "POST /api/v1/projects/:id/environment/start — ensure workspace is up",
          "POST /api/v1/projects/:id/tasks — submit prompt",
          "GET /api/v1/tasks/:taskId?wait=true — wait for completion",
          "GET /api/v1/projects/:id/logs?source=task&task_id=… — optional task log stream",
          "POST /api/v1/projects/:id/deploy — run the app after changes",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        text: "Link GitHub on your Synaro account so tasks can commit using your token when clone_repository_url is set on the project.",
      },
    ],
  },
  "public-api-agents": {
    slug: "public-api-agents",
    title: "Public API — agents",
    description:
      "Manage standalone AI agents, trigger runs, and inspect run output via the public API.",
    blocks: [
      {
        type: "p",
        text: "Standalone agents are user-scoped automations with a system prompt, optional tools (web search, HTTP), and cron scheduling. They run in agent-runner and do not require a project container. The public API proxies to agent-service; responses use snake_case.",
      },
      {
        type: "h2",
        text: "List and create agents",
      },
      {
        type: "h3",
        text: "GET /api/v1/agents",
      },
      {
        type: "p",
        text: "Returns agents owned by the API key's user.",
      },
      {
        type: "h3",
        text: "POST /api/v1/agents",
      },
      {
        type: "p",
        text: "Creates an agent. Prefer camelCase fields matching the dashboard/session API (name, systemPrompt, toolMode, tools, schedule, mcpServers, …). Snake_case aliases such as system_prompt are accepted. The userId is set automatically from your API key—do not rely on passing another user's id. Persisted MCP credentials in the body are rejected.",
      },
      {
        type: "code",
        title: "Example create",
        code: `curl -s -X POST \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Research bot",
    "systemPrompt": "Summarize top news about AI infrastructure.",
    "toolMode": "auto",
    "tools": ["web_search"]
  }' \\
  https://YOUR_HOST/api/v1/agents`,
      },
      {
        type: "h2",
        text: "Single agent",
      },
      {
        type: "table",
        headers: ["Endpoint", "Method", "Description"],
        rows: [
          ["/api/v1/agents/:agentId", "GET", "Fetch agent configuration"],
          ["/api/v1/agents/:agentId", "PATCH", "Update agent fields"],
          ["/api/v1/agents/:agentId", "DELETE", "Delete agent (204)"],
        ],
      },
      {
        type: "h2",
        text: "Trigger a run",
      },
      {
        type: "h3",
        text: "POST /api/v1/agents/:agentId/trigger",
      },
      {
        type: "p",
        text: "Starts an on-demand agent run. Optional JSON body can include run-specific input depending on agent configuration. Returns run metadata from agent-service (snake_case).",
      },
      {
        type: "h2",
        text: "Runs",
      },
      {
        type: "h3",
        text: "GET /api/v1/agents/:agentId/runs",
      },
      {
        type: "p",
        text: "Lists past runs for the agent (newest first). Optional query params: limit (default 20, max 100), offset.",
      },
      {
        type: "h3",
        text: "GET /api/v1/runs/:runId",
      },
      {
        type: "p",
        text: "Fetches a single run by ID, including status and output when complete.",
      },
      {
        type: "h2",
        text: "Cancel, credentials, and run feeds",
      },
      {
        type: "table",
        headers: ["Endpoint", "Method", "Description"],
        rows: [
          ["/api/v1/runs/:runId/cancel", "POST", "Cancel an active run (PENDING, RUNNING, NEEDS_INPUT)"],
          ["/api/v1/runs/:runId/credentials", "POST", "Submit mcp_auth / mcpAuth and resume a NEEDS_INPUT run"],
          ["/api/v1/runs/active", "GET", "Active runs for the API key user"],
          ["/api/v1/runs/recent", "GET", "Recent runs (optional limit)"],
        ],
      },
      {
        type: "h2",
        text: "Agent memory",
      },
      {
        type: "table",
        headers: ["Endpoint", "Method", "Description"],
        rows: [
          ["/api/v1/agents/:agentId/memory", "GET", "List memory entries"],
          ["/api/v1/agents/:agentId/memory", "DELETE", "Clear all memory"],
          ["/api/v1/agents/:agentId/memory/:key", "PUT", "Upsert entry ({ content })"],
          ["/api/v1/agents/:agentId/memory/:key", "DELETE", "Delete one entry"],
        ],
      },
      {
        type: "h2",
        text: "Run statuses",
      },
      {
        type: "table",
        headers: ["Status", "Meaning"],
        rows: [
          ["PENDING", "Queued"],
          ["RUNNING", "ReAct loop in progress"],
          ["NEEDS_INPUT", "Paused for MCP credentials"],
          ["DONE", "Finished; output available"],
          ["FAILED", "Error or max steps without finish"],
          ["CANCELLED", "Stopped by user"],
        ],
      },
      {
        type: "callout",
        variant: "info",
        text: "Scheduled agents require agent-runner with valid KIMI_API_KEY and BRAVE_SEARCH_API_KEY (when web_search is enabled). Cron registration happens at runner startup—restart the runner after changing schedules. Prefer @synaro/sdk for poll helpers — see /documentation/public-api-sdk.",
      },
    ],
  },
  "public-api-sdk": {
    slug: "public-api-sdk",
    title: "Public API — TypeScript SDK",
    description:
      "Official @synaro/sdk client for /api/v1: install, typed resources, watch iterators, errors, and the synaro CLI.",
    blocks: [
      {
        type: "p",
        text: "The official TypeScript/JavaScript SDK wraps Synaro’s public API (/api/v1). It handles Bearer authentication, snake_case/camelCase conversion, rate-limit retries, long-running helpers (deploy, task run, agent run), async watch iterators, and a thin CLI. Use it from Node.js 18+, scripts, CI, and server-side apps.",
      },
      {
        type: "callout",
        variant: "info",
        title: "API keys",
        text: "Mint keys in Settings → API keys. The secret (sk_live_…) is shown once. Pass it as apiKey to the client or set SYNARO_API_KEY for the CLI. There is no public endpoint to create keys.",
      },
      {
        type: "h2",
        text: "Install",
      },
      {
        type: "code",
        title: "npm",
        code: `npm install @synaro/sdk
# or: pnpm add @synaro/sdk / yarn add @synaro/sdk`,
      },
      {
        type: "p",
        text: "In this monorepo the package lives at packages/sdk. Build with npm run build inside that folder; the CLI binary is dist/cli.js.",
      },
      {
        type: "h2",
        text: "Create a client",
      },
      {
        type: "code",
        title: "Basic client",
        code: `import { Synaro } from "@synaro/sdk";

const synaro = new Synaro({
  apiKey: process.env.SYNARO_API_KEY!,
  // baseUrl: "https://synaro.tech",     // production (default)
  // baseUrl: "http://localhost:3000",   // local app
  timeoutMs: 30_000,
  retryOnRateLimit: true,
});

const me = await synaro.me();
console.log(me.userId, me.email);`,
      },
      {
        type: "table",
        headers: ["Option", "Default", "Description"],
        rows: [
          ["apiKey", "(required)", "Dashboard API key (sk_live_…)"],
          ["baseUrl", "https://synaro.tech", "Origin only — no /api/v1 suffix"],
          ["timeoutMs", "30000", "Default CRUD timeout in milliseconds"],
          ["retryOnRateLimit", "true", "Retry once on HTTP 429 using Retry-After"],
          ["onRequest / onResponse", "—", "Optional debug hooks"],
        ],
      },
      {
        type: "h2",
        text: "Quickstart: project → deploy → AI task",
      },
      {
        type: "code",
        title: "End-to-end script",
        code: `import { Synaro } from "@synaro/sdk";

const synaro = new Synaro({ apiKey: process.env.SYNARO_API_KEY! });

const project = await synaro.projects.create({
  name: "demo-api",
  description: "Created via @synaro/sdk",
});
console.log("project", project.projectId, project.environmentStatus);

const deploy = await synaro.projects.deploy(project.projectId, {
  waitUntilReady: true,
  timeoutSeconds: 300,
});
console.log("preview", deploy.previewUrl);

const task = await synaro.tasks.run(
  project.projectId,
  "Add a GET /health route that returns { ok: true }",
);
console.log(task.summary);
console.log(task.git?.htmlUrl);`,
      },
      {
        type: "h2",
        text: "Projects",
      },
      {
        type: "p",
        text: "Manage workspaces and environments. Responses use camelCase (projectId, environmentStatus, …).",
      },
      {
        type: "table",
        headers: ["Method", "Maps to", "Notes"],
        rows: [
          ["projects.list()", "GET /api/v1/projects", "Projects visible to the key’s user"],
          ["projects.create(input)", "POST /api/v1/projects", "name, description, repositoryUrl, dockerImage"],
          ["projects.get(id)", "GET /api/v1/projects/:id", "Single project"],
          ["projects.delete(id)", "DELETE …", "204; destroys remote environments"],
          ["projects.start / stop(id)", "POST …/environment/start|stop", "409 if already provisioning on start"],
          ["projects.deploy(id, opts?)", "POST …/deploy", "waitUntilReady, timeoutSeconds"],
          ["projects.logs(id, opts?)", "GET …/logs", "source: runtime | task"],
          ["projects.ensureRunning(id)", "composed", "Start + poll status until run-ready"],
          ["projects.withPreview(id)", "composed", "Deploy then return project + previewUrl"],
        ],
      },
      {
        type: "code",
        title: "Ensure running and fetch logs",
        code: `await synaro.projects.ensureRunning(projectId, {
  timeoutMs: 180_000,
  pollIntervalMs: 2_000,
});

const logs = await synaro.projects.logs(projectId, {
  source: "runtime",
  lines: 100,
});
console.log(logs.lines.join("\\n"));`,
      },
      {
        type: "h2",
        text: "AI tasks",
      },
      {
        type: "p",
        text: "Project-scoped AI work (generate or answer). tasks.run creates a task and waits; tasks.watch polls with wait=false and yields each snapshot.",
      },
      {
        type: "code",
        title: "Create, watch progress, or one-shot run",
        code: `// One-shot: create + server-side wait
const result = await synaro.tasks.run(projectId, "Refactor auth middleware", {
  mode: "generate",
  timeoutSeconds: 300,
});

// Or create then watch client-side
const created = await synaro.tasks.create(projectId, {
  prompt: "Explain the billing module",
  mode: "answer",
});

for await (const snap of synaro.tasks.watch(created.taskId, {
  pollIntervalMs: 2_000,
  timeoutMs: 300_000,
})) {
  console.log(snap.status, snap.progress ?? "");
  if (snap.status === "DONE") {
    console.log(snap.summary);
  }
}`,
      },
      {
        type: "h2",
        text: "Agents & runs",
      },
      {
        type: "p",
        text: "Standalone agents do not need a project container. Every agent DTO exposes a canonical agentId (mapped from wire id). Every run exposes runId the same way.",
      },
      {
        type: "code",
        title: "Create agent, run, and watch status",
        code: `const agent = await synaro.agents.create({
  name: "Nightly summary",
  systemPrompt: "Summarize recent repo changes in markdown.",
  toolMode: "auto",
  tools: ["web_search"],
  schedule: null,
  enabled: true,
});

console.log(agent.agentId); // always set

const run = await synaro.agents.run(
  agent.agentId,
  "Summarize what changed yesterday",
  { pollIntervalMs: 2_000, timeoutMs: 300_000 },
);
console.log(run.runId, run.status, run.output);

// Or trigger + watch yourself
const { runId } = await synaro.agents.trigger(agent.agentId, {
  input: "Ping",
  trigger: "manual",
});

for await (const snap of synaro.runs.watch(runId)) {
  console.log(snap.status);
  if (snap.status === "NEEDS_INPUT") {
    // Submit MCP credentials then continue waiting
    await synaro.runs.submitCredentials(snap.runId, {
      github: { Authorization: "Bearer ghp_…" },
    });
  }
}`,
      },
      {
        type: "table",
        headers: ["Method", "Description"],
        rows: [
          ["agents.list / get / create / update / delete", "CRUD; writes use camelCase (systemPrompt, toolMode, …)"],
          ["agents.trigger(id, { input? })", "Returns { runId }; HTTP 202"],
          ["agents.run(id, input?, opts?)", "Trigger + wait until DONE / FAILED / CANCELLED"],
          ["agents.listRuns(id, { limit?, offset? })", "Paginated run history"],
          ["agents.memory(id).list|upsert|delete|clear", "Agent memory CRUD"],
          ["runs.get / wait / watch / cancel", "Inspect, poll, or cancel a run"],
          ["runs.active() / recent({ limit? })", "User-scoped run feeds"],
          ["runs.submitCredentials(runId, mcpAuth)", "Resume NEEDS_INPUT runs"],
        ],
      },
      {
        type: "h2",
        text: "Errors",
      },
      {
        type: "p",
        text: "HTTP failures become typed errors. Preserve status and body.error / body.detail for logging.",
      },
      {
        type: "code",
        title: "Typed error handling",
        code: `import {
  Synaro,
  AuthError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  NeedsInputError,
  SynaroError,
} from "@synaro/sdk";

try {
  await synaro.agents.run(agentId, "hello");
} catch (err) {
  if (err instanceof AuthError) {
    console.error("Invalid API key");
  } else if (err instanceof NeedsInputError) {
    console.error("Paused for credentials", err.runId);
  } else if (err instanceof RateLimitError) {
    console.error("Rate limited; retry after", err.retryAfterSec, "s");
  } else if (err instanceof NotFoundError) {
    console.error("Missing resource");
  } else if (err instanceof ConflictError) {
    console.error("Conflict", err.message);
  } else if (err instanceof SynaroError) {
    console.error(err.status, err.body);
  } else {
    throw err;
  }
}`,
      },
      {
        type: "table",
        headers: ["Class", "Typical status", "When"],
        rows: [
          ["AuthError", "401", "Missing or invalid API key"],
          ["NotFoundError", "404", "Resource not visible to this user"],
          ["ConflictError", "409", "e.g. env already provisioning"],
          ["RateLimitError", "429", "Per-key fixed window exceeded"],
          ["NeedsInputError", "409 (logical)", "Agent run status NEEDS_INPUT"],
          ["SynaroError", "4xx/5xx", "Base class; includes 502 upstream failures"],
        ],
      },
      {
        type: "h2",
        text: "CLI",
      },
      {
        type: "p",
        text: "The package ships a synaro binary (npx synaro … after publish, or node packages/sdk/dist/cli.js locally). Auth via SYNARO_API_KEY; optional SYNARO_BASE_URL.",
      },
      {
        type: "code",
        title: "Common commands",
        code: `export SYNARO_API_KEY=sk_live_…
# export SYNARO_BASE_URL=http://localhost:3000

npx synaro me
npx synaro projects list
npx synaro projects deploy <projectId>
npx synaro projects deploy <projectId> --no-wait
npx synaro agents list
npx synaro agents run <agentId> "Summarize yesterday"
npx synaro tasks run <projectId> Add a health check route
npx synaro runs wait <runId>
npx synaro runs cancel <runId>
npx synaro --help`,
      },
      {
        type: "callout",
        variant: "tip",
        title: "CI tip",
        text: "Store SYNARO_API_KEY as a secret. Prefer tasks.run / agents.run / projects.deploy with explicit timeouts so pipelines fail fast instead of hanging.",
      },
      {
        type: "h2",
        text: "Conventions",
      },
      {
        type: "ul",
        items: [
          "TypeScript public API is camelCase; the SDK converts wire snake_case for you",
          "Agent create/update bodies are sent camelCase (systemPrompt, toolMode, mcpServers)",
          "Agent and run objects always include agentId / runId (normalized from id when needed)",
          "Non-idempotent: create, trigger, deploy, tasks.create — do not blindly retry without checking state",
          "Default rate limit is about 120 requests per 60 seconds per API key",
          "Raw HTTP contract: see packages/sdk/openapi/v1.yaml and the other Public API doc pages",
        ],
      },
      {
        type: "h2",
        text: "Related pages",
      },
      {
        type: "ul",
        items: [
          "Overview & authentication — /documentation/public-api",
          "Projects & environments — /documentation/public-api-projects",
          "AI tasks — /documentation/public-api-tasks",
          "Agents — /documentation/public-api-agents",
        ],
      },
    ],
  },
  architecture: {
    slug: "architecture",
    title: "Architecture",
    description: "Control plane, microservices, and infrastructure layering.",
    blocks: [
      {
        type: "p",
        text: "Synaro uses a modular backend: the Next.js app is the product surface and BFF (API routes, NextAuth, Prisma). Specialized services own Docker, projects, AI, and execution.",
      },
      {
        type: "code",
        title: "High-level diagram",
        code: `┌─────────────────────────────────────────┐
│         Next.js App (port 3000)         │
│  Dashboard · Projects · Agents · APIs   │
└────────────────────┬────────────────────┘
                     │
     ┌───────────────┼───────────────┬──────────────┬──────────────┐
     ▼               ▼               ▼              ▼              ▼
 Project Svc    Environment Svc   AI Orch Svc   Execution Mgr  Agent Svc
  :3001            :3002            :3003          :3004         :3007
     │               │               │              │              │
     │               │               │              │              ▼
     │               │               │              │         Agent Runner
     │               │               │              │            :3008
     └───────────────┴───────────────┴──────────────┘              │
                     │                                             │
              Docker · PostgreSQL ◄────────────────────────────────┘`,
      },
      {
        type: "h2",
        text: "Responsibilities",
      },
      {
        type: "table",
        headers: ["Service", "Role"],
        rows: [
          ["project-service", "Project CRUD and service-side metadata (Fastify)"],
          ["environment-service", "Container lifecycle, files, terminal WS, git operations, workspace download"],
          ["ai-orchestration-service", "LLM tasks, repo analysis, patch application"],
          ["execution-manager", "Process run/stop, log capture, runtime monitoring"],
          ["agent-service", "Agent CRUD, run triggers, completion webhooks"],
          ["agent-runner", "ReAct execution loop, tool calls, cron scheduler"],
        ],
      },
    ],
  },
  "tech-stack": {
    slug: "tech-stack",
    title: "Tech stack",
    description: "Languages, frameworks, and infrastructure used across the monorepo.",
    blocks: [
      {
        type: "table",
        headers: ["Layer", "Technologies"],
        rows: [
          ["Frontend", "Next.js 16 (Pages Router), React 19, TypeScript, Tailwind CSS 4, Framer Motion"],
          ["UI", "Radix UI primitives, shadcn-style components, Lucide icons, Recharts, xterm.js"],
          ["Auth", "NextAuth.js, Prisma adapter, bcrypt credentials, GitHub OAuth"],
          ["App data", "Prisma 5, PostgreSQL 16"],
          ["Services", "Node.js, Fastify 4, Zod, tsx (dev)"],
          ["AI", "Moonshot / Kimi API (K2.6) via ai-orchestration-service and agent-runner"],
          ["Agent tools", "Brave Search API (web_search), SSRF-safe HTTP client"],
          ["Runtime", "Docker (dev via socket mount), Kubernetes manifests in /k8s"],
          ["Testing", "Jest, Testing Library"],
        ],
      },
      {
        type: "h2",
        text: "Monorepo layout",
      },
      {
        type: "ul",
        items: [
          "app/ — Next.js product and API routes",
          "services/project-service/",
          "services/environment-service/",
          "services/ai-orchestration-service/",
          "services/agent-service/",
          "services/agent-runner/",
          "services/execution-manager/",
          "k8s/ — deployment manifests",
          "docker-compose.yml — local multi-service stack",
        ],
      },
    ],
  },
  services: {
    slug: "services",
    title: "Services & APIs",
    description: "Ports, databases, and representative API routes in the app.",
    blocks: [
      {
        type: "table",
        headers: ["Service", "Default port", "Database"],
        rows: [
          ["Next.js app", "3000", "PostgreSQL (synaro) — users, projects, invites, sessions"],
          ["project-service", "3001", "PostgreSQL (synaro_project_service)"],
          ["ai-orchestration-service", "3003", "PostgreSQL (synaro) — tasks"],
          ["environment-service", "3002 (host 3004)", "PostgreSQL (synaro_env)"],
          ["execution-manager", "3004", "—"],
          ["agent-service", "3005 (host 3007)", "PostgreSQL (synaro) — agents, runs"],
          ["agent-runner", "3006 (host 3008)", "PostgreSQL (synaro) — shared schema"],
          ["PostgreSQL (app)", "5433", "synaro"],
          ["PostgreSQL (env)", "5434", "synaro_env"],
        ],
      },
      {
        type: "h2",
        text: "App API routes (examples)",
      },
      {
        type: "p",
        text: "Dashboard routes require a NextAuth session. For automation, use the Public API (/api/v1) with API keys—see the Public API section in this documentation.",
      },
      {
        type: "ul",
        items: [
          "/api/v1/* — public API (Bearer API key); projects, tasks, agents, deploy",
          "/api/account/api-keys — create and revoke keys (session only)",
          "/api/projects — list and create projects",
          "/api/projects/[projectId]/workspace-files — file tree",
          "/api/projects/[projectId]/workspace-selection — file/folder detail",
          "/api/projects/[projectId]/run — start app process",
          "/api/projects/[projectId]/ai-clarify — clarification questions",
          "/api/projects/[projectId]/ai-task — create project AI task",
          "/api/ai-tasks/[taskId] — poll AI task status",
          "/api/agents — list and create standalone agents",
          "/api/agents/[agentId]/trigger — start an agent run",
          "/api/agents/[agentId]/runs — list runs for an agent",
          "/api/invites/[token] — accept project invite",
          "/api/auth/* — NextAuth handlers",
        ],
      },
    ],
  },
  "local-development": {
    slug: "local-development",
    title: "Local development",
    description: "Run the full stack with Docker Compose and environment variables.",
    blocks: [
      {
        type: "h2",
        text: "Prerequisites",
      },
      {
        type: "ul",
        items: [
          "Node.js 20+",
          "Docker Desktop (for environment-service socket access)",
          "PostgreSQL clients optional (migrations via Prisma)",
        ],
      },
      {
        type: "h2",
        text: "Start infrastructure",
      },
      {
        type: "code",
        title: "From repository root",
        code: `docker compose up -d postgresql postgresql-env
cd app && npm install && npm run db:migrate:local
docker compose up project-service environment-service ai-orchestration-service execution-manager agent-service agent-runner
cd app && npm run dev`,
      },
      {
        type: "h2",
        text: "Environment files",
      },
      {
        type: "p",
        text: "Copy env examples into app/.env.local (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GitHub OAuth if used). Set KIMI_API_KEY for AI tasks and agents. Set BRAVE_SEARCH_API_KEY and AGENT_SERVICE_KEY for agent web search and service auth. Point AGENT_SERVICE_URL at http://localhost:3007 when running agents locally. environment-service reads app/.env.local via docker-compose env_file.",
      },
      {
        type: "callout",
        variant: "tip",
        text: "After changing Prisma schemas, run migrate/generate in the relevant package before restarting services.",
      },
    ],
  },
  security: {
    slug: "security",
    title: "Security",
    description: "Sandboxing, auth, and safe execution of user code.",
    blocks: [
      {
        type: "p",
        text: "User code runs inside Docker containers—not on the host Node process. Synaro aims to combine OS-level isolation with quotas and network restrictions.",
      },
      {
        type: "ul",
        items: [
          "Per-project environments with start/stop controls",
          "Session-based auth; API routes check project membership",
          "Public API keys (sk_live_…) for /api/v1; hashed at rest, revocable from Settings",
          "Invite tokens with expiry and revocation",
          "Preview iframes sandboxed (allow-scripts, same-origin where needed)",
          "Agent HTTP tools block private IPs and cap response size (SSRF protection)",
          "Planned: stricter network egress and idle teardown policies",
        ],
      },
    ],
  },
  roadmap: {
    slug: "roadmap",
    title: "Roadmap",
    description: "What ships today and what is planned next.",
    blocks: [
      {
        type: "h2",
        text: "MVP (shipped)",
      },
      {
        type: "ul",
        items: [
          "Project creation from natural language",
          "AI scaffolding and task application in project chat",
          "Docker environment provisioning and workspace download",
          "Dashboard, logs, workspace UI, and Agents page",
          "Standalone AI agents with web search, HTTP tools, and cron scheduling",
          "Agent edit UI, enable/disable toggles, and per-step run trace viewer",
          "Public API v1 (/api/v1) with per-user API keys for projects, tasks, and agents",
        ],
      },
      {
        type: "h2",
        text: "Infrastructure phase",
      },
      {
        type: "ul",
        items: [
          "Deeper Kubernetes integration",
          "Environment autoscaling",
          "Advanced metrics and alerting",
        ],
      },
      {
        type: "h2",
        text: "Automation phase",
      },
      {
        type: "ul",
        items: [
          "CI-style test pipelines per project",
          "Self-optimization recommendations",
          "Collaborative real-time editing",
        ],
      },
    ],
  },
};
