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
};

export function routeMatches(pathname: string, route: string): boolean {
  if (route === "/projects/") {
    return pathname.startsWith("/projects/") && !pathname.endsWith("/analytics");
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

export const ONBOARDING_TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: "welcome",
    route: "/dashboard",
    title: "Welcome to Synaro",
    description:
      "This quick tour highlights the main parts of the app. You can click highlighted areas to try them — we'll guide you step by step.",
    placement: "center",
  },
  {
    id: "sidebar",
    route: "/dashboard",
    selector: '[data-onboarding="sidebar"]',
    title: "Navigation",
    description:
      "Use the sidebar to jump between Dashboard, Projects, Logs, and Settings. Your account menu is at the bottom.",
    placement: "right",
    encourageClick: "Try clicking Projects — the tour will follow you.",
    advanceOnNavigateTo: { prefix: "/projects", stepId: "projects-new" },
  },
  {
    id: "header",
    route: "/dashboard",
    selector: '[data-onboarding="header-actions"]',
    title: "Header tools",
    description:
      "Notifications tell you when AI tasks finish. The ? button replays this tour anytime. The pill shows when AI is working in the background.",
    placement: "bottom",
  },
  {
    id: "dashboard-projects",
    route: "/dashboard",
    selector: '[data-onboarding="dashboard-projects"]',
    title: "Your projects at a glance",
    description:
      "Recent projects appear here on the home dashboard. Open one or go to the full Projects page to create or import.",
    placement: "top",
    encourageClick: "Click a project card to open it, or hit Next to continue.",
    advanceOnNavigateTo: { prefix: "/projects/", stepId: "workspace-tabs" },
  },
  {
    id: "projects-new",
    route: "/projects",
    selectors: ['[data-onboarding="new-project-dialog"]', '[data-onboarding="new-project"]'],
    title: "Create or import",
    description:
      "Start blank, import from GitHub, or upload a local folder. Each project gets its own Docker workspace and AI chat.",
    placement: "bottom",
    navigateTo: "/projects",
    encourageClick: "Click + New project to open this dialog, then explore the form.",
  },
  {
    id: "projects-open",
    route: "/projects",
    selector: '[data-onboarding="project-card-link"]',
    title: "Open a project",
    description:
      "Click any project to enter the workspace — file tree, terminal, AI chat, and deployments live here.",
    placement: "bottom",
    encourageClick: "Click a project — the tour will continue inside the workspace.",
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
    id: "docker-pill",
    route: "/projects/",
    selector: '[data-onboarding="docker-pill"]',
    title: "Runtime environment",
    description:
      "Start or stop the Docker container for this project. Files and the terminal need the runtime to be running.",
    placement: "left",
    encourageClick: "Try starting the runtime if it's stopped.",
    skipIf: () => !hasProjects(),
  },
  {
    id: "ai-chat",
    route: "/projects/",
    selector: '[data-onboarding="tab-chat"]',
    title: "AI chat",
    description:
      "Describe what you want in plain English. Synaro analyzes your repo, asks clarifying questions when needed, and applies code changes.",
    placement: "bottom",
    onEnter: () => dispatchWorkspaceTab("chat"),
    encourageClick: "Click the AI chat tab if it's not already selected.",
    skipIf: () => !hasProjects(),
  },
  {
    id: "ai-composer",
    route: "/projects/",
    selector: '[data-onboarding="ai-composer"]',
    title: "Send a prompt",
    description:
      "Type your request here and press Enter. You'll see live progress, file-change previews, and can expand the activity log on the response.",
    placement: "top",
    onEnter: () => dispatchWorkspaceTab("chat"),
    encourageClick: "Try typing a small request — or continue with Next.",
    skipIf: () => !hasProjects(),
  },
  {
    id: "file-tree",
    route: "/projects/",
    selector: '[data-onboarding="tab-tree"]',
    title: "File tree",
    description:
      "Browse files in your container workspace. Open files to view and edit them — the tree refreshes when the AI writes changes.",
    placement: "bottom",
    onEnter: () => dispatchWorkspaceTab("tree"),
    encourageClick: "Click File tree to explore your project files.",
    skipIf: () => !hasProjects(),
  },
  {
    id: "terminal",
    route: "/projects/",
    selector: '[data-onboarding="tab-terminal"]',
    title: "Terminal",
    description:
      "Run shell commands directly in your project container — install packages, run scripts, or debug alongside the AI.",
    placement: "bottom",
    onEnter: () => dispatchWorkspaceTab("terminal"),
    encourageClick: "Click Terminal to open the in-browser shell.",
    skipIf: () => !hasProjects(),
  },
  {
    id: "deployments",
    route: "/projects/",
    selector: '[data-onboarding="tab-deployments"]',
    title: "Deployments & preview",
    description:
      "Run your app and open a live preview. Use Run in the toolbar when the container is active, then preview from here.",
    placement: "bottom",
    onEnter: () => dispatchWorkspaceTab("deployments"),
    encourageClick: "Click Deployments to see preview options.",
    skipIf: () => !hasProjects(),
  },
  {
    id: "finish",
    route: "/dashboard",
    title: "You're ready to build",
    description:
      "Create a project, start the runtime, and describe your first change in AI chat. Press ? anytime to replay this tour.",
    placement: "center",
    navigateTo: "/dashboard",
  },
];

export function getPreviousEffectiveStepIndex(index: number): number {
  let i = index - 1;
  while (i >= 0) {
    const step = ONBOARDING_TOUR_STEPS[i];
    if (!step?.skipIf?.()) return i;
    i--;
  }
  return 0;
}

export function getEffectiveStepIndex(index: number): number {
  let i = index;
  while (i < ONBOARDING_TOUR_STEPS.length) {
    const step = ONBOARDING_TOUR_STEPS[i];
    if (step?.skipIf?.()) {
      i++;
      continue;
    }
    break;
  }
  return Math.min(i, ONBOARDING_TOUR_STEPS.length - 1);
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
