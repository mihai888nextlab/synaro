export type AiTaskStatus = "PENDING" | "ANALYZING" | "GENERATING" | "APPLYING" | "DONE" | "FAILED";

export type AiRemoteTask = {
  id: string;
  status: AiTaskStatus;
  progress?: string | null;
  streamContent?: string | null;
  errorMessage?: string | null;
  result?: TaskResult | unknown | null;
  projectId?: string | null;
};

export type TaskGitResult = {
  action?: string;
  branch?: string;
  commitSha?: string | null;
  remoteUrl?: string;
  htmlUrl?: string;
  noChanges?: boolean;
};

export type TaskResult = {
  summary?: string | null;
  changes: { path: string; content: string; previousContent?: string | null }[];
  meta?: { exploredFiles?: number; aiSteps?: number };
  git?: TaskGitResult;
};
