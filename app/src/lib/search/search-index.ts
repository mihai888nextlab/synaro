export type SearchIndexProject = {
  id: string;
  slug: string;
  name: string;
  description: string;
};

export type SearchIndexAgent = {
  id: string;
  name: string;
  description: string;
};

export type SearchIndexActivityLog = {
  id: string;
  action: string;
  status: string;
  entityName: string;
  href: string | null;
  occurredAt: string | null;
};

export type SearchIndexAgentRun = {
  id: string;
  agentId: string;
  agentName: string;
  status: string;
  createdAt: string;
};

export type SearchIndex = {
  projects: SearchIndexProject[];
  agents: SearchIndexAgent[];
  activityLogs: SearchIndexActivityLog[];
  agentRuns: SearchIndexAgentRun[];
};
