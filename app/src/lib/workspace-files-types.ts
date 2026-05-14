/** Response shape for `GET /api/projects/[projectId]/workspace-files`. */
export type WorkspaceFilesResponse = {
  paths: string[];
  truncated: boolean;
  rootLabel: string;
  reason?: "no_environment" | "not_active" | "unreachable" | "clone_pending";
  detail?: string;
};
