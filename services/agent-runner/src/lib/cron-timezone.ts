export const DEFAULT_AGENT_CRON_TIMEZONE = 'Europe/Bucharest'

/** IANA timezone for interpreting cron expressions (e.g. `0 16 * * *` → 16:00 local). */
export function getAgentCronTimezone(): string {
  const fromEnv = process.env.AGENT_CRON_TIMEZONE?.trim()
  return fromEnv || DEFAULT_AGENT_CRON_TIMEZONE
}
