// Logical day: a day ends at `dayStartHour` the next morning, in Asia/Ho_Chi_Minh (UTC+7, no DST).
// This is the only place that cuts timestamps into days.

const VN_OFFSET_MS = 7 * 3_600_000
const DAY_MS = 86_400_000

export const DEFAULT_DAY_START_HOUR = 4

function dateKeyToMs(dateKey: string): number {
  const ms = Date.parse(`${dateKey}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new Error(`Invalid dateKey: ${dateKey}`)
  return ms
}

function msToDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function toDateKey(
  ts: string | number | Date,
  dayStartHour = DEFAULT_DAY_START_HOUR,
): string {
  const ms = new Date(ts).getTime()
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${String(ts)}`)
  return msToDateKey(ms + VN_OFFSET_MS - dayStartHour * 3_600_000)
}

export function addDays(dateKey: string, n: number): string {
  return msToDateKey(dateKeyToMs(dateKey) + n * DAY_MS)
}

/** All dateKeys from `from` to `to`, both inclusive. Empty if `from > to`. */
export function dateKeyRange(from: string, to: string): string[] {
  const keys: string[] = []
  for (let ms = dateKeyToMs(from); ms <= dateKeyToMs(to); ms += DAY_MS) keys.push(msToDateKey(ms))
  return keys
}

/** Day of week of a dateKey: Monday = 0 … Sunday = 6. */
export function weekday(dateKey: string): number {
  return (new Date(dateKeyToMs(dateKey)).getUTCDay() + 6) % 7
}
