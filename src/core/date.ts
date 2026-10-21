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

/** ISO string with +07:00 offset, e.g. 2026-10-20T00:40:00.000+07:00. */
export function toIso(ts: number | Date = Date.now()): string {
  const ms = new Date(ts).getTime()
  return new Date(ms + VN_OFFSET_MS).toISOString().replace('Z', '+07:00')
}

/** ISO timestamp of `HH:mm` on a logical day. Hours before `dayStartHour` fall on the next calendar day. */
export function atTime(
  dateKey: string,
  hhmm: string,
  dayStartHour = DEFAULT_DAY_START_HOUR,
): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const dayOffset = h < dayStartHour ? 1 : 0
  const ms = dateKeyToMs(dateKey) + dayOffset * DAY_MS + (h * 60 + m) * 60_000 - VN_OFFSET_MS
  return toIso(ms)
}

/** `HH:mm` (Vietnam time) of a timestamp. */
export function toHHmm(ts: string | number | Date): string {
  return toIso(new Date(ts)).slice(11, 16)
}
