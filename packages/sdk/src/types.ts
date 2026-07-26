export type Me = {
  userId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
};

export type PlatformStatus = {
  app: string;
  environmentService: string;
  aiService: string;
};

export type ProjectStatusSlice = {
  id: string;
  environmentStatus: string;
  runReady: boolean;
  previewUrl: string | null;
};

export type StatusResponse = {
  platform: PlatformStatus;
  project?: ProjectStatusSlice;
};

export type Project = {
  projectId: string;
  slug: string;
  name: string;
  description: string | null;
  environmentStatus: string;
  repositoryLocation: string | null;
  cloneRepositoryUrl: string | null;
  createdAt: string;
  updatedAt: string;
  environmentWarning?: string | null;
};

export type CreateProjectInput = {
  name?: string;
  description?: string;
  repositoryUrl?: string;
  dockerImage?: string;
};

export type EnvironmentControlResult = {
  environmentStatus: string;
  previewUrl: string | null;
  repositoryLocation?: string | null;
};

export type DeployOptions = {
  waitUntilReady?: boolean;
  timeoutSeconds?: number;
};

export type DeployResult = {
  environmentStatus: string;
  runStatus: string;
  previewUrl: string | null;
  command: string;
};

export type LogsOptions = {
  source?: "runtime" | "task";
  lines?: number;
  taskId?: string;
};

export type LogsResult = {
  source: string;
  lines: string[];
  taskId?: string;
  status?: string;
};

export type TaskMode = "generate" | "answer";

export type CreateTaskInput = {
  prompt: string;
  mode?: TaskMode;
};

export type CreateTaskResult = {
  taskId: string;
  status: string;
  pollUrl: string;
};

export type TaskResult = {
  taskId: string;
  projectId: string;
  status: string;
  progress?: string | null;
  summary?: string | null;
  changes?: unknown[];
  git?: { htmlUrl?: string; branch?: string } | null;
  meta?: Record<string, unknown> | null;
  errorMessage?: string | null;
  streamContent?: string | null;
  timedOut?: boolean;
};

export type GetTaskOptions = {
  wait?: boolean;
  timeoutSeconds?: number;
};

export type ToolMode = "auto" | "manual";

export type McpServerConfig = {
  name: string;
  url: string;
  transport?: "http" | "sse";
  headers?: Record<string, string>;
};

export type Agent = {
  /** Canonical agent id (always set by the SDK from wire `id` / `agentId`). */
  agentId: string;
  /** Alias of `agentId` for back-compat with raw API payloads. */
  id?: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  toolMode?: ToolMode;
  tools?: string[];
  maxSteps?: number;
  schedule?: string | null;
  enabled?: boolean;
  emailOnComplete?: boolean;
  model?: string | null;
  mcpServers?: McpServerConfig[];
  projectId?: string | null;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type CreateAgentInput = {
  name: string;
  systemPrompt: string;
  description?: string;
  toolMode?: ToolMode;
  tools?: string[];
  maxSteps?: number;
  schedule?: string | null;
  enabled?: boolean;
  emailOnComplete?: boolean;
  model?: string;
  mcpServers?: McpServerConfig[];
  projectId?: string;
};

export type UpdateAgentInput = Partial<CreateAgentInput>;

export type TriggerOptions = {
  input?: string;
  trigger?: "manual" | "cron" | "webhook";
};

export type TriggerResult = {
  runId: string;
};

export type ListRunsOptions = {
  limit?: number;
  offset?: number;
};

export type AgentRunStatus =
  | "PENDING"
  | "RUNNING"
  | "NEEDS_INPUT"
  | "DONE"
  | "FAILED"
  | "CANCELLED"
  | string;

export type AgentRun = {
  /** Canonical run id (always set by the SDK from wire `id` / `runId`). */
  runId: string;
  /** Alias of `runId` for back-compat with raw API payloads. */
  id?: string;
  agentId: string;
  status: AgentRunStatus;
  trigger?: string;
  input?: string | null;
  output?: string | null;
  /** Structured dashboard artifacts from finish({ artifacts }). */
  artifacts?: unknown;
  steps?: unknown[];
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
  agent?: { id: string; name: string };
  credentialRequest?: unknown;
  [key: string]: unknown;
};

export type MemoryEntry = {
  key: string;
  content: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type WaitOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
  onUpdate?: (run: AgentRun) => void;
  signal?: AbortSignal;
};

export type WatchOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
};

export type EnsureRunningOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
};
