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
  /** Open the mobile sidebar drawer so sidebar targets are measurable below lg. */
  needsMobileSidebar?: boolean;
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
  /** Match any authenticated shell page that shows the dashboard sidebar. */
  if (route === "*") {
    return (
      pathname === "/dashboard" ||
      pathname === "/projects" ||
      pathname.startsWith("/projects/") ||
      pathname === "/agents" ||
      pathname.startsWith("/agents/") ||
      pathname === "/logs" ||
      pathname === "/settings" ||
      pathname.startsWith("/settings/")
    );
  }
  if (route.endsWith("/")) return pathname.startsWith(route);
  return pathname === route;
}

export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

/** Dashboard customize controls are desktop-only (md+). */
export function isDashboardCustomizeViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 768px)").matches;
}

export function dispatchWorkspaceTab(tab: WorkspaceTab) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("synaro:onboarding-action", { detail: { type: "workspace-tab", tab } }),
  );
}

export function dispatchOpenMobileSidebar() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("synaro:onboarding-action", { detail: { type: "open-mobile-sidebar" } }),
  );
}

export function dispatchCloseMobileSidebar() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("synaro:onboarding-action", { detail: { type: "close-mobile-sidebar" } }),
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

function hasAgents(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('[data-onboarding="agent-run"]'));
}

export function getStepIndexById(id: string, steps: OnboardingTourStep[] = ONBOARDING_TOUR_STEPS): number {
  return steps.findIndex((s) => s.id === id);
}

const ONBOARDING_STEP_I18N_KEYS: Record<string, string> = {
  welcome: "welcome",
  sidebar: "sidebar",
  "dashboard-edit": "dashboardEdit",
  "dashboard-widgets": "dashboardWidgets",
  "nav-projects": "navProjects",
  "projects-new": "projectsNew",
  "projects-open": "projectsOpen",
  "workspace-ai": "workspaceAi",
  "docker-runtime": "dockerRuntime",
  "nav-agents": "navAgents",
  agents: "agents",
  "agents-run": "agentsRun",
  "agents-run-dialog": "agentsRunDialog",
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

/**
 * Broader product tour. Empty accounts skip workspace / agent-run steps via skipIf.
 * Navigation between major areas is click-to-advance (user drives the sidebar).
 */
export const ONBOARDING_TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: "welcome",
    route: "/dashboard",
    title: "Welcome to Synaro",
    description:
      "A guided tour of the main parts of the app. Click highlighted areas when prompted — the tour follows your actions.",
    placement: "center",
  },
  {
    id: "sidebar",
    route: "/dashboard",
    selector: '[data-onboarding="sidebar"]',
    title: "Navigation",
    description:
      "The sidebar is your home base: Dashboard, Projects, Agents, and Logs. Your account menu (including Settings) is at the bottom.",
    placement: "right",
    needsMobileSidebar: true,
  },
  {
    id: "dashboard-edit",
    route: "/dashboard",
    selector: '[data-onboarding="dashboard-edit"]',
    title: "Customize your dashboard",
    description:
      "Edit mode lets you rearrange and resize widgets. Changes save automatically while you customize.",
    placement: "bottom",
    encourageClick: "Click Edit to enter customize mode.",
    advanceOnTargetClick: true,
    advanceWhenVisible: {
      selector: '[data-onboarding="dashboard-add-widget"]',
      stepId: "dashboard-widgets",
    },
    onEnter: () => dispatchCloseMobileSidebar(),
    skipIf: () => !isDashboardCustomizeViewport(),
  },
  {
    id: "dashboard-widgets",
    route: "/dashboard",
    selectors: [
      '[data-onboarding="dashboard-add-widget"]',
      '[data-onboarding="dashboard-customize"]',
    ],
    title: "Add and arrange widgets",
    description:
      "Use Add widget to open the gallery. Drag widgets onto the grid, then resize with the corner handle or size chips. Click Done when you're finished.",
    placement: "bottom",
    encourageClick: "Click Add widget to browse the gallery, or continue with Next.",
    skipIf: () => !isDashboardCustomizeViewport(),
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
    needsMobileSidebar: true,
  },
  {
    id: "projects-new",
    route: "/projects",
    selectors: ['[data-onboarding="new-project-dialog"]', '[data-onboarding="new-project"]'],
    title: "Create or import",
    description:
      "Start blank, import from GitHub, or upload a folder. Pick a runtime and describe what you want to build.",
    placement: "bottom",
    encourageClick: "Click + New project to open the creation dialog, or continue with Next.",
    onEnter: () => dispatchCloseMobileSidebar(),
  },
  {
    id: "projects-open",
    route: "/projects",
    selector: '[data-onboarding="project-card-link"]',
    title: "Open a project",
    description:
      "Click a project card to enter the workspace — AI chat, files, terminal, and deployments live there.",
    placement: "bottom",
    encourageClick: "Click a project — the tour continues inside the workspace.",
    advanceOnTargetClick: true,
    advanceOnNavigateTo: { prefix: "/projects/", stepId: "workspace-ai" },
    skipIf: () => !hasProjects(),
  },
  {
    id: "workspace-ai",
    route: "/projects/",
    selectors: ['[data-onboarding="ai-composer"]', '[data-onboarding="workspace-tabs"]'],
    title: "Workspace & AI chat",
    description:
      "Use the tabs for AI chat, file tree, terminal, and deployments. Describe changes in plain English — Synaro analyzes the repo and applies code.",
    placement: "top",
    navigateTo: () => firstProjectHref(),
    onEnter: () => dispatchWorkspaceTab("chat"),
    skipIf: () => !hasProjects(),
  },
  {
    id: "docker-runtime",
    route: "/projects/",
    selector: '[data-onboarding="docker-pill"]',
    title: "Runtime & terminal",
    description:
      "Start the Docker runtime so files, terminal, and previews work. Use the Terminal tab for shell commands in the container.",
    placement: "left",
    encourageClick: "Try starting the runtime if it's stopped, then continue.",
    skipIf: () => !hasProjects(),
  },
  {
    id: "nav-agents",
    route: "*",
    selector: '[data-onboarding="nav-agents"]',
    title: "AI agents",
    description:
      "Agents are separate from project chat — use them for web research, HTTP calls, and scheduled tasks that return a text answer.",
    placement: "right",
    encourageClick: "Click Agents in the sidebar to open the agents page.",
    advanceOnTargetClick: true,
    advanceOnNavigateTo: { prefix: "/agents", stepId: "agents" },
    needsMobileSidebar: true,
  },
  {
    id: "agents",
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
    encourageClick: "Click + New agent to peek at the setup form, or continue with Next.",
    onEnter: () => dispatchCloseMobileSidebar(),
  },
  {
    id: "agents-run",
    route: "/agents",
    selectors: ['[data-onboarding="agent-run"]', '[data-onboarding="agent-runs-link"]'],
    title: "Run an agent",
    description:
      "Press Run on an agent card to start a live run (you can add optional input). Use Runs to open history and inspect steps or output.",
    placement: "left",
    encourageClick: "Click Run on an agent if you have one, or continue with Next.",
    advanceWhenVisible: {
      selector: '[data-onboarding="agent-trigger-dialog"]',
      stepId: "agents-run-dialog",
    },
    skipIf: () => !hasAgents(),
  },
  {
    id: "agents-run-dialog",
    route: "/agents",
    selector: '[data-onboarding="agent-trigger-dialog"]',
    title: "Confirm the run",
    description:
      "Add optional input, then press Run Agent. You can follow progress from the header pill and the agent's run history.",
    placement: "left",
    encourageClick: "Review the form, then continue with Next when you're ready.",
    skipIf: () => {
      if (typeof document === "undefined") return true;
      return !document.querySelector('[data-onboarding="agent-trigger-dialog"]');
    },
  },
  {
    id: "finish",
    route: "/dashboard",
    title: "You're ready to build",
    description:
      "Customize your dashboard, build in projects, or run agents for research. Open the help menu (circle icon) anytime to replay this tour or open documentation.",
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

export function isAppShellPath(pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  if (pathname === "/projects/invite/[token]") return false;
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return true;
  if (pathname === "/agents" || pathname.startsWith("/agents/")) return true;
  if (pathname === "/logs") return true;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return true;
  return false;
}
