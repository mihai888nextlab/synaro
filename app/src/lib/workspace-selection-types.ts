export type WorkspacePathKind = "file" | "directory" | "missing" | "notfile";

export type WorkspaceGitCommitLine = {
  shortSha: string;
  author: string;
  date: string;
  subject: string;
};

/** Payload returned by environment-service `GET .../workspace-selection`. */
export type RemoteWorkspaceSelection = {
  path: string;
  kind: WorkspacePathKind;
  content: string | null;
  contentTruncated: boolean;
  gitLog: WorkspaceGitCommitLine[];
};

export type WorkspaceSelectionGithubCommit = {
  shortSha: string;
  htmlUrl: string;
  author: string;
  date: string;
  message: string;
};

export type WorkspaceSelectionGithubExtras = {
  fileCommits: WorkspaceSelectionGithubCommit[];
  lastWorkflowRun: {
    name: string;
    status: string;
    conclusion: string | null;
    createdAt: string;
    htmlUrl: string;
  } | null;
  openPullRequests: { number: number; title: string; htmlUrl: string; updatedAt: string }[];
};

/** Merged response for the dashboard `workspace-selection` API route. */
export type WorkspaceSelectionApiResponse = RemoteWorkspaceSelection & {
  github?: WorkspaceSelectionGithubExtras;
};
