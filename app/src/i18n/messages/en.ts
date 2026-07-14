import type { Messages } from "@/i18n/messages/types";
import { mergeMessages } from "@/i18n/messages/merge";
import { enAppExt } from "@/i18n/messages/en/app-ext";

const enBase: Messages = {
  common: {
    saving: "Saving…",
    comingSoon: "Coming soon",
    cancel: "Cancel",
    save: "Save",
    back: "Back",
    viewAll: "View all",
    open: "Open",
    remove: "Remove",
    delete: "Delete",
    create: "Create",
    search: "Search",
    loading: "Loading…",
    error: "Something went wrong.",
  },
  nav: {
    dashboard: "Dashboard",
    projects: "Projects",
    agents: "Agents",
    logs: "Logs",
    settings: "Settings",
    documentation: "Documentation",
    pricing: "Pricing",
    profile: "Profile",
    preferences: "Preferences",
    apiKeys: "API keys",
    signOut: "Sign out",
    account: "Account",
    notSignedIn: "Not signed in",
  },
  settings: {
    title: "Settings",
    placeholder:
      "Placeholder settings. This will become workspace, security, and billing.",
    workspace: "Workspace",
    security: "Security",
    billing: "Billing",
    integrations: "Integrations",
    manageApiKeys: "Manage API keys",
    preferencesTitle: "Preferences",
    appearance: "Appearance",
    appearanceHint:
      "Control your dashboard appearance. Current: {mode}.",
    appearanceSystem: "System ({resolved})",
    themeSystem: "System",
    themeSystemDesc: "Match your OS appearance",
    themeDark: "Dark",
    themeDarkDesc: "Dark surfaces and subtle borders",
    themeLight: "Light",
    themeLightDesc: "Bright surfaces and crisp contrast",
    language: "Language",
    languageHint: "Choose the language used across the Synaro interface.",
    languageEnglish: "English",
    languageRomanian: "Romanian",
  },
  dashboard: {
    customizeTitle: "Customize dashboard",
    edit: "Edit",
    addWidget: "Add widget",
    done: "Done",
    reset: "Reset",
    removeWidget: "Remove widget",
    kpiProjects: "Projects",
    kpiRunning: "Running",
    kpiStarting: "Starting",
    kpiStoppedErrors: "Stopped / errors",
    kpiNoData: "No data",
    kpiProjectsUpdatedWeek: "{count} updated in the last 7 days",
    kpiProjectsNoUpdates: "No project updates in the last 7 days",
    kpiNoEnvironmentsRunning: "No environments running",
    kpiMoreEnvironments: "+{count} more",
    kpiProvisioning: "Provisioning in progress",
    kpiNothingStarting: "Nothing starting right now",
    kpiNeedAttention: "{count} need attention",
    kpiStoppedCount: "{count} stopped",
    kpiAllClear: "All clear",
    projectsTitle: "Projects",
    agentsTitle: "Agents",
    activityTitle: "Recent activity",
    viewLogs: "View logs",
    noLogsTitle: "There are no logs",
    noLogsBody: "No activity yet. Start or stop a project container to see events here.",
  },
  auth: {
    signIn: "Sign in",
    signUp: "Sign up",
    email: "Email",
    password: "Password",
    name: "Name",
    continueWithGoogle: "Continue with Google",
    continueWithGitHub: "Continue with GitHub",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
  },
  landing: {
    getStarted: "Get started",
    signIn: "Sign in",
  },
  about: {
    meta: {
      title: "About",
      description:
        "Synaro is an AI development workspace from Timișoara, Romania — built by co-founders Cristian Stiegelbauer and Mihai Gorunescu.",
    },
    hero: {
      badge: "About Synaro",
      title: "AI dev workspace from Romania.",
      subtitle:
        "Co-founded by two high school students in Timișoara, building a workspace for modern software development.",
      cityLabel: "Timișoara",
    },
    mission: {
      title: "Our mission",
      body: "Synaro brings Docker workspaces, AI-assisted editing, live preview, and agents into one place. We started the project to reduce the friction of juggling separate tools, and we are building it from Timișoara for developers who want a clear, capable workflow.",
    },
    europe: {
      title: "Built in Europe",
      pillar1Title: "European roots",
      pillar1Body:
        "We build from Romania for developers who want their tools and infrastructure closer to home.",
      pillar2Title: "Transparent by design",
      pillar2Body:
        "Isolated environments, open documentation, and a stack you can inspect and understand.",
      pillar3Title: "Built by users",
      pillar3Body:
        "We use Synaro every day to build Synaro, so product decisions stay grounded in real workflows.",
    },
    vest: {
      label: "Program",
      title: "Part of Vest Ventures",
      body: "Synaro is part of the Vest Ventures pre-accelerator in Timișoara, where we work with mentors and other founders to refine the product and grow the company.",
      link: "vestventures.vc",
    },
    team: {
      title: "The team",
      schoolLine:
        "Students at Grigore Moisil Theoretical High School, Timișoara — ages 16 and 17.",
      cristianName: "Cristian Stiegelbauer",
      cristianRole: "Co-founder · CPO",
      cristianBio: "Leads product direction, user experience, and roadmap.",
      mihaiName: "Mihai Gorunescu",
      mihaiRole: "Co-founder · CTO",
      mihaiBio: "Leads architecture, infrastructure, and platform reliability.",
    },
    cta: {
      title: "Try Synaro",
      subtitle: "Create an account and start your first project in minutes.",
      getStarted: "Get started",
      readDocs: "Read the docs",
    },
  },
};

export const enMessages = mergeMessages(enBase, enAppExt);

export type { Messages };
