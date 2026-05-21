export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; code: string; title?: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; variant: "info" | "tip"; title?: string; text: string };

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  blocks: DocBlock[];
};

export type DocNavGroup = {
  title: string;
  items: { slug: string; label: string }[];
};

export const DEFAULT_DOC_SLUG = "what-is-synaro";

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
          "Browse files, open a web terminal, and preview running apps",
          "Run AI tasks that generate, validate, and apply repository changes",
          "Invite collaborators and track platform activity in logs",
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
          ["AI chat", "Natural-language tasks with clarification, voice input (Web Speech API), and auto-apply on completion"],
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
          "UI shows progress, resulting paths, and errors inline in the thread",
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
│  Dashboard · Projects · API routes      │
└────────────────────┬────────────────────┘
                     │
     ┌───────────────┼───────────────┬──────────────┐
     ▼               ▼               ▼              ▼
 Project Svc    Environment Svc   AI Orch Svc   Execution Mgr
  :3001            :3002            :3003          :3004
     │               │               │              │
     └───────────────┴───────────────┴──────────────┘
                     │
              Docker · PostgreSQL`,
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
          ["environment-service", "Container lifecycle, files, terminal WS, git operations"],
          ["ai-orchestration-service", "LLM tasks, repo analysis, patch application"],
          ["execution-manager", "Process run/stop, log capture, runtime monitoring"],
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
          ["AI", "Moonshot / Kimi API via ai-orchestration-service"],
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
          ["PostgreSQL (app)", "5433", "synaro"],
          ["PostgreSQL (env)", "5434", "synaro_env"],
        ],
      },
      {
        type: "h2",
        text: "App API routes (examples)",
      },
      {
        type: "ul",
        items: [
          "/api/projects — list and create projects",
          "/api/projects/[projectId]/workspace-files — file tree",
          "/api/projects/[projectId]/workspace-selection — file/folder detail",
          "/api/projects/[projectId]/run — start app process",
          "/api/projects/[projectId]/ai-clarify — clarification questions",
          "/api/ai-tasks/[taskId] — poll AI task status",
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
docker compose up project-service environment-service ai-orchestration-service execution-manager
cd app && npm run dev`,
      },
      {
        type: "h2",
        text: "Environment files",
      },
      {
        type: "p",
        text: "Copy env examples into app/.env.local (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GitHub OAuth if used). Set KIMI_API_KEY for AI features. environment-service reads app/.env.local via docker-compose env_file.",
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
          "Invite tokens with expiry and revocation",
          "Preview iframes sandboxed (allow-scripts, same-origin where needed)",
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
          "AI scaffolding and task application",
          "Docker environment provisioning",
          "Dashboard, logs, workspace UI",
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

export const DOC_SLUGS = Object.keys(DOC_PAGES);

export function getDocPage(slug: string | undefined): DocPage | null {
  const key = slug && slug.length > 0 ? slug : DEFAULT_DOC_SLUG;
  return DOC_PAGES[key] ?? null;
}

export function docHref(slug: string): string {
  return slug === DEFAULT_DOC_SLUG ? "/documentation" : `/documentation/${slug}`;
}

/** Flat sidebar order for previous / next page navigation. */
export const DOC_NAV_ORDER = DOC_NAV.flatMap((group) => group.items);

export function getDocAdjacent(slug: string): {
  prev: (typeof DOC_NAV_ORDER)[number] | null;
  next: (typeof DOC_NAV_ORDER)[number] | null;
} {
  const index = DOC_NAV_ORDER.findIndex((item) => item.slug === slug);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? DOC_NAV_ORDER[index - 1]! : null,
    next: index < DOC_NAV_ORDER.length - 1 ? DOC_NAV_ORDER[index + 1]! : null,
  };
}
