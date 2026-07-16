import { SynaroHttpClient, type SynaroClientOptions } from "./client.js";
import { AgentsResource } from "./resources/agents.js";
import { MeResource } from "./resources/me.js";
import { ProjectsResource } from "./resources/projects.js";
import { RunsResource } from "./resources/runs.js";
import { StatusResource } from "./resources/status.js";
import { TasksResource } from "./resources/tasks.js";

export type { SynaroClientOptions };

/**
 * Official Synaro public API client (`/api/v1`, Bearer `sk_live_…` keys).
 *
 * ```ts
 * const synaro = new Synaro({ apiKey: process.env.SYNARO_API_KEY! });
 * const me = await synaro.me();
 * ```
 */
export class Synaro {
  readonly http: SynaroHttpClient;
  readonly projects: ProjectsResource;
  readonly tasks: TasksResource;
  readonly agents: AgentsResource;
  readonly runs: RunsResource;
  private readonly meResource: MeResource;
  private readonly statusResource: StatusResource;

  constructor(opts: SynaroClientOptions) {
    this.http = new SynaroHttpClient(opts);
    this.projects = new ProjectsResource(this.http);
    this.tasks = new TasksResource(this.http);
    this.runs = new RunsResource(this.http);
    this.agents = new AgentsResource(this.http, this.runs);
    this.meResource = new MeResource(this.http);
    this.statusResource = new StatusResource(this.http);
  }

  me() {
    return this.meResource.me();
  }

  status(opts?: { projectId?: string }) {
    return this.statusResource.status(opts);
  }
}
