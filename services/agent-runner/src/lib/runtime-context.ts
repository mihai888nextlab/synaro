import { getAgentCronTimezone } from './cron-timezone.js'

/**
 * Authoritative wall-clock context for the model (date/time + output guidance).
 * Injected as a system message on every run so agents need not search for "today".
 */
export function buildRuntimeContextMessage(now: Date = new Date()): string {
  const timeZone = getAgentCronTimezone()
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(now)

  return [
    `Current date/time: ${local} (${timeZone}). ISO (UTC): ${now.toISOString()}.`,
    'Treat this as authoritative "today" / "now". Do not search the web just to learn the current date or time.',
    '',
    'Product UI shows artifacts only (dashboard + run page). finish().answer is a short internal API summary (1–2 sentences), not the main user-facing result.',
    'When calling finish(), always attach artifacts when the task has data — design a short visual story:',
    '- Pick about 1–3 artifacts that best fit (max 12). Skip types that do not help.',
    '- Order matters: put the hero insight first, then supporting detail. Mark the lead piece with emphasis: "hero" when useful.',
    '- Choose form from content: ranking (ordered lists), timeline (sequences/plans), comparison (side-by-side options), funnel (stages/conversion), timeseries_chart (trends), kpi_row (few key numbers), data_table (dense grids), news_list (headlines), markdown (short narrative).',
    '- Vary the mix across runs; never invent numbers not grounded in tools or context.',
  ].join('\n')
}
