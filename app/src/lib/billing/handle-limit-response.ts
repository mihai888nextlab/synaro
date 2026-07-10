/**
 * Client helper for the hard-cap 402 responses emitted by billing guards.
 * Detects `{ error: "limit_exceeded", metric, limit, upgradeUrl }` and returns a
 * human-friendly message + upgrade link. Call sites can show a toast/modal and
 * route the user to billing.
 */

export type LimitExceeded = {
  metric: string;
  limit: number;
  upgradeUrl: string;
  message: string;
};

const METRIC_COPY: Record<string, string> = {
  agent_runs: "You've reached your monthly agent-run limit.",
  projects: "You've reached the project limit for your plan.",
  concurrent_environments: "You've reached the running-environment limit for your plan.",
  trial_expired: "Your free trial has ended.",
};

/**
 * If `res` is a 402 limit response, parse it and return details; otherwise null.
 * Consumes the response body, so only call when you're done with `res`.
 */
export async function parseLimitResponse(res: Response): Promise<LimitExceeded | null> {
  if (res.status !== 402) return null;
  let body: Record<string, unknown> = {};
  try {
    body = (await res.clone().json()) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (body.error !== "limit_exceeded") return null;

  const metric = typeof body.metric === "string" ? body.metric : "unknown";
  const limit = typeof body.limit === "number" ? body.limit : 0;
  const upgradeUrl =
    (typeof body.upgradeUrl === "string" && body.upgradeUrl) ||
    (typeof body.upgrade_url === "string" && body.upgrade_url) ||
    "/settings/billing";

  return {
    metric,
    limit,
    upgradeUrl,
    message: METRIC_COPY[metric] ?? "You've hit a plan limit.",
  };
}
