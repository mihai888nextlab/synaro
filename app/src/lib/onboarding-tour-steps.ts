export type WorkspaceTab = "chat" | "tree" | "terminal" | "deployments";

export type OnboardingTourStep = {
  id: string;
  /** Page where this step is shown. Use `/projects/` prefix for project workspace routes. */
  route: string;
  /** CSS selector; omit for centered welcome/finish cards. */
  selector?: string;
  /** Try selectors in order — first visible match wins (e.g. dialog after it opens). */
  selectors?: string[];
  title: string;
  description: string;
  /** Short hint encouraging the user to click the spotlight target. */
  encourageClick?: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  /** Navigate here when advancing *to* this step (from the previous step's Next). */
  navigateTo?: string | (() => string | null);
  /** Run when the step becomes active (e.g. switch workspace tab). */
  onEnter?: () => void;
  /** Skip this step when true (e.g. no projects yet). */
  skipIf?: () => boolean;
  /** When the user navigates to this route prefix, jump to this step id. */
  advanceOnNavigateTo?: { prefix: string; stepId: string };
  /** Advance to the next step when the user clicks the highlighted target. */
  advanceOnTargetClick?: boolean;
  /** When this selector becomes visible, jump to the given step (e.g. dialog opened). */
  advanceWhenVisible?: { selector: string; stepId: string };
  /** When the workspace tab changes to this value, advance to the next step. */
  advanceOnWorkspaceTab?: WorkspaceTab;
};

export function routeMatches(pathname: string, route: string): boolean {
  if (route === "/projects/") {
    return pathname.startsWith("/projects/") && !pathname.endsWith("/analytics");
  }
  if (route === "/projects") {
    return pathname === "/projects";
  }
  if (route === "/agents") {
    return pathname === "/agents" || pathname.startsWith("/agents/");
  }
  if (route.endsWith("/")) return pathname.startsWith(route);
  return pathname === route;
}

export function dispatchWorkspaceTab(tab: WorkspaceTab) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("synaro:onboarding-action", { detail: { type: "workspace-tab", tab } }),
  );
}

function firstProjectHref(): string | null {
  if (typeof document === "undefined") return null;
  const link = document.querySelector<HTMLAnchorElement>('[data-onboarding="project-card-link"]');
  return link?.getAttribute("href") ?? null;
}

function hasProjects(): boolean {
  return Boolean(firstProjectHref());
}

export function getStepIndexById(id: string, steps: OnboardingTourStep[] = ONBOARDING_TOUR_STEPS): number {
  return steps.findIndex((s) => s.id === id);
}

const ONBOARDING_STEP_I18N_KEYS: Record<string, string> = {
  welcome: "welcome",
  sidebar: "sidebar",
  "nav-projects": "navProjects",
  "projects-new": "projectsNew",
  "projects-new-dialog": "projectsNewDialog",
  "projects-open": "projectsOpen",
  "workspace-tabs": "workspaceTabs",
  "ai-chat": "aiChat",
  "ai-composer": "aiComposer",
  "file-tree": "fileTree",
  "docker-pill": "dockerPill",
  terminal: "terminal",
  deployments: "deployments",
  "nav-agents": "navAgents",
  "agents-intro": "agentsIntro",
  "agents-create-dialog": "agentsCreateDialog",
  header: "header",
  finish: "finish",
};

export function getOnboardingTourSteps(t: (key: string) => string): OnboardingTourStep[] {
  return ONBOARDING_TOUR_STEPS.map((step) => {
    const key = ONBOARDING_STEP_I18N_KEYS[step.id];
    if (!key) return step;
    return {
      ...step,
      title: t(`onboarding.steps.${key}.title`),
      description: t(`onboarding.steps.${key}.description`),
      encourageClick: step.encourageClick
        ? t(`onboarding.steps.${key}.encourageClick`)
        : undefined,
    };
  });
}

export const ONBOARDING_TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: "welcome",
    route: "/dashboard",
    title: "Welcome to Synaro",
    description:
      "This tour walks through the main parts of the app. Click highlighted areas when prompted — the tour will follow your actions.",
    placement: "center",
  },
  {
    id: "sidebar",
    route: "/dashboard",
    selector: '[data-onboarding="sidebar"]',
    title: "Navigation",
    description:
      "The sidebar is your home base: Dashboard, Projects, Agents, Logs, and Settings. Your account menu is at the bottom.",
    placement: "right",
  },
  {
    id: "nav-projects",
    route: "/dashboard",
    selector: '[data-onboarding="nav-projects"]',
    title: "Projects",
    description:
      "Every app you build lives in a project with its own Docker workspace, file tree, terminal, and AI chat.",
    placement: "right",
    encourageClick: "Click Projects — we'll open the projects page.",
    advanceOnTargetClick: true,
    advanceOnNavigateTo: { prefix: "/projects", stepId: "projects-new" },
  },
  {
    id: "projects-new",
    route: "/projects",
    selectors: ['[data-onboarding="new-project-dialog"]', '[data-onboarding="new-project"]'],
    title: "Create or import",
    description:
      "Start blank, import from GitHub, or upload a folder. Each project gets an isolated container and AI chat.",
    placement: "bottom",
    navigateTo: "/projects",
    encourageClick: "Click + New project to open the creation dialog.",
    advanceWhenVisible: { selector: '[data-onboarding="new-project-dialog"]', stepId: "projects-new-dialog" },
  },
  {
    id: "projects-new-dialog",
    route: "/projects",
    selector: '[data-onboarding="new-project-dialog"]',
    title: "Project setup",
    description:
      "Pick a runtime image and describe what you want to build. You can also import GitHub repos or upload files.",
    placement: "right",
    encourageClick: "Explore the form, then click Next — or open an existing project below.",
    skipIf: () => {
      if (typeof document === "undefined") return true;
      return !document.querySelector('[data-onboarding="new-project-dialog"]');
    },
  },
  {
    id: "projects-open",
    route: "/projects",
    selector: '[data-onboarding="project-card-link"]',
    title: "Open a project",
    description:
      "Click any project card to enter the workspace — file tree, terminal, AI chat, and deployments live there.",
    placement: "bottom",
    encourageClick: "Click a project — the tour continues inside the workspace.",
    advanceOnTargetClick: true,
    advanceOnNavigateTo: { prefix: "/projects/", stepId: "workspace-tabs" },
    skipIf: () => !hasProjects(),
  },
  {
    id: "workspace-tabs",
    route: "/projects/",
    selector: '[data-onboarding="workspace-tabs"]',
    title: "Workspace tabs",
    description:
      "Switch between AI chat, file tree, terminal, and deployments. Everything runs inside your project's container.",
    placement: "bottom",
    navigateTo: () => firstProjectHref(),
    onEnter: () => dispatchWorkspaceTab("chat"),
    skipIf: () => !hasProjects(),
  },
  {
    id: "ai-chat",
    route: "/projects/",
    selector: '[data-onboarding="tab-chat"]',
    title: "AI chat",
    description:
      "Describe changes in plain English. Synaro analyzes your repo, asks clarifying questions when needed, and applies code.",
    placement: "bottom",
    encourageClick: "Click AI chat to select this tab.",
    advanceOnTargetClick: true,
    advanceOnWorkspaceTab: "chat",
    skipIf: () => !hasProjects(),
  },
  {
    id: "ai-composer",
    route: "/projects/",
    selector: '[data-onboarding="ai-composer"]',
    title: "Send a prompt",
    description:
      "Type your request and press Enter. You'll see live progress, file-change previews, and markdown responses.",
    placement: "top",
    onEnter: () => dispatchWorkspaceTab("chat"),
    skipIf: () => !hasProjects(),
  },
  {
    id: "file-tree",
    route: "/projects/",
    selector: '[data-onboarding="tab-tree"]',
    title: "File tree",
    description:
      "Browse files in your container workspace. Open files to view and edit — the tree refreshes when the AI writes changes.",
    placement: "bottom",
    encourageClick: "Click File tree to explore your project files.",
    advanceOnTargetClick: true,
    advanceOnWorkspaceTab: "tree",
    skipIf: () => !hasProjects(),
  },
  {
    id: "docker-pill",
    route: "/projects/",
    selector: '[data-onboarding="docker-pill"]',
    title: "Runtime environment",
    description:
      "Start or stop the Docker container for this project. Files, terminal, and previews need the runtime running.",
    placement: "left",
    encourageClick: "Try starting the runtime if it's stopped.",
    skipIf: () => !hasProjects(),
  },
  {
    id: "terminal",
    route: "/projects/",
    selector: '[data-onboarding="tab-terminal"]',
    title: "Terminal",
    description:
      "Run shell commands in your project container — install packages, run scripts, or debug alongside the AI.",
    placement: "bottom",
    encourageClick: "Click Terminal to open the in-browser shell.",
    advanceOnTargetClick: true,
    advanceOnWorkspaceTab: "terminal",
    skipIf: () => !hasProjects(),
  },
  {
    id: "deployments",
    route: "/projects/",
    selector: '[data-onboarding="tab-deployments"]',
    title: "Deployments & preview",
    description:
      "Run your app and open a live preview. Use Run in the toolbar when the container is active.",
    placement: "bottom",
    encourageClick: "Click Deployments to see preview options.",
    advanceOnTargetClick: true,
    advanceOnWorkspaceTab: "deployments",
    skipIf: () => !hasProjects(),
  },
  {
    id: "nav-agents",
    route: "/dashboard",
    selector: '[data-onboarding="nav-agents"]',
    title: "AI agents",
    description:
      "Agents are separate from project chat — use them for web research, HTTP calls, and scheduled tasks that return a text answer.",
    placement: "right",
    navigateTo: "/dashboard",
    encourageClick: "Click Agents in the sidebar.",
    advanceOnTargetClick: true,
    advanceOnNavigateTo: { prefix: "/agents", stepId: "agents-intro" },
  },
  {
    id: "agents-intro",
    route: "/agents",
    selectors: [
      '[data-onboarding="new-agent-dialog"]',
      '[data-onboarding="new-agent"]',
      '[data-onboarding="agents-grid"]',
    ],
    title: "Build an agent",
    description:
      "Create agents with a system prompt and tools (web search, HTTP GET/POST). Run them on demand or on a cron schedule.",
    placement: "bottom",
    navigateTo: "/agents",
    encourageClick: "Click + New agent to see the setup form.",
    advanceWhenVisible: { selector: '[data-onboarding="new-agent-dialog"]', stepId: "agents-create-dialog" },
  },
  {
    id: "agents-create-dialog",
    route: "/agents",
    selector: '[data-onboarding="new-agent-dialog"]',
    title: "Agent configuration",
    description:
      "Name your agent, write a system prompt, pick tools, and set max steps. Optional cron syntax runs the agent automatically.",
    placement: "right",
    encourageClick: "Review the options, then continue with Next.",
    skipIf: () => {
      if (typeof document === "undefined") return true;
      return !document.querySelector('[data-onboarding="new-agent-dialog"]');
    },
  },
  {
    id: "header",
    route: "/dashboard",
    selector: '[data-onboarding="header-actions"]',
    title: "Header tools",
    description:
      "Notifications alert you when AI tasks finish. The ? menu replays this tour or opens documentation. The pill shows background AI work.",
    placement: "bottom",
    navigateTo: "/dashboard",
  },
  {
    id: "finish",
    route: "/dashboard",
    title: "You're ready to build",
    description:
      "Create a project for code changes, or an agent for research tasks. Press ? anytime for the intro tour or docs.",
    placement: "center",
    navigateTo: "/dashboard",
  },
];

export function getPreviousEffectiveStepIndex(
  index: number,
  steps: OnboardingTourStep[] = ONBOARDING_TOUR_STEPS,
): number {
  let i = index - 1;
  while (i >= 0) {
    const step = steps[i];
    if (!step?.skipIf?.()) return i;
    i--;
  }
  return 0;
}

export function getEffectiveStepIndex(
  index: number,
  steps: OnboardingTourStep[] = ONBOARDING_TOUR_STEPS,
): number {
  let i = index;
  while (i < steps.length) {
    const step = steps[i];
    if (step?.skipIf?.()) {
      i++;
      continue;
    }
    break;
  }
  return Math.min(i, steps.length - 1);
}

export function resolveNavigateTo(step: OnboardingTourStep): string | null {
  if (!step.navigateTo) return null;
  if (typeof step.navigateTo === "function") return step.navigateTo();
  return step.navigateTo;
}

export function resolveStepSelectors(step: OnboardingTourStep): string[] {
  if (step.selectors?.length) return step.selectors;
  if (step.selector) return [step.selector];
  return [];
}

export function findClickedTourTarget(selectors: string[], clicked: Node): HTMLElement | null {
  for (const sel of selectors) {
    for (const node of document.querySelectorAll(sel)) {
      if (!(node instanceof HTMLElement)) continue;
      if (node === clicked || node.contains(clicked)) return node;
    }
  }
  return null;
}

export function findVisibleTourTarget(selectors: string[]): Element | null {
  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      return el;
    }
  }
  return null;
}

export function isElementVisible(selector: string): boolean {
  return findVisibleTourTarget([selector]) !== null;
}
