/** Response shape for `GET /api/projects/[projectId]/workspace-files`. */
export type WorkspaceFilesResponse = {
  paths: string[];
  truncated: boolean;
  rootLabel: string;
  /** True when the project has a GitHub clone URL (vs blank / folder-only workspace). */
  hasGitRemote?: boolean;
  reason?: "no_environment" | "not_active" | "unreachable" | "clone_pending";
  detail?: string;
};
