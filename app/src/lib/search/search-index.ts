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

export type SearchIndex = {
  projects: SearchIndexProject[];
  agents: SearchIndexAgent[];
};
