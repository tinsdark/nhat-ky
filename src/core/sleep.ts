import { addDays, toHHmm, toIso } from './date'
import type { Entry } from './types'

/** Minutes since 18:00, so bedtimes either side of midnight sit next to each other (23:30 → 330, 01:00 → 420). */
function sinceEvening(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return (((h * 60 + m - 18 * 60) % 1440) + 1440) % 1440
}

/** Mean bedtime of the given sleep starts as `HH:mm`, or null when there are none. */
export function averageBedtime(starts: string[]): string | null {
  if (starts.length === 0) return null
  const mean = starts.reduce((sum, s) => sum + sinceEvening(toHHmm(s)), 0) / starts.length
  const total = (Math.round(mean) + 18 * 60) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Timestamp of the bedtime `hhmm` that precedes `now`: times from 12:00 on belong to the previous
 * calendar day, earlier times (after midnight) to the same day as `now`.
 */
export function bedtimeBefore(now: number, hhmm: string): string {
  const today = toIso(now).slice(0, 10)
  const date = Number(hhmm.slice(0, 2)) >= 12 ? addDays(today, -1) : today
  return `${date}T${hhmm}:00.000+07:00`
}

/** Night sleep still open (no `end`), started within the last `maxHours`. Naps are ignored. */
export function findOpenNightSleep(
  entries: Entry[],
  now: number,
  maxHours = 24,
): Entry | undefined {
  return entries
    .filter(
      (e) =>
        e.type === 'sleep' &&
        !e.deleted &&
        e.end === null &&
        e.payload.nap !== true &&
        now - new Date(e.start).getTime() <= maxHours * 3_600_000,
    )
    .sort((a, b) => b.start.localeCompare(a.start))[0]
}

/**
 * Bedtime to assume when "Thức dậy" is pressed without a matching "Đi ngủ": the usual bedtime
 * (`usual`, HH:mm) if that gives a believable night of 2–14 hours, else `targetHours` before `now`.
 */
export function estimateBedtime(now: number, usual: string | null, targetHours: number): string {
  if (usual) {
    const candidate = bedtimeBefore(now, usual)
    const hours = (now - new Date(candidate).getTime()) / 3_600_000
    if (hours >= 2 && hours <= 14) return candidate
  }
  return toIso(now - targetHours * 3_600_000)
}
