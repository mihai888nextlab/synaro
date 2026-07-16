import { Synaro, type SynaroClientOptions } from "../synaro.js";

export function createCliClient(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<SynaroClientOptions> = {},
): Synaro {
  const apiKey = (overrides.apiKey ?? env.SYNARO_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("SYNARO_API_KEY is required");
  }
  return new Synaro({
    apiKey,
    baseUrl: overrides.baseUrl ?? env.SYNARO_BASE_URL ?? "https://synaro.tech",
    retryOnRateLimit: overrides.retryOnRateLimit ?? true,
    fetch: overrides.fetch,
    ...overrides,
  });
}
