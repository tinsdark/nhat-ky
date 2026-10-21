import { toDateKey, toHHmm, weekday } from './date'
import type { Settings } from './types'

/** `HH:mm:ss`, or `H:mm:ss` style without a day limit (a timer left running overnight keeps counting). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/**
 * Overtime = the block is not entirely inside the declared working hours of a working day
 * (`workDays`, `workStart`–`workEnd`). A block that crosses midnight is always overtime.
 */
export function isOvertime(
  start: string,
  end: string,
  settings: Pick<Settings, 'workDays' | 'workStart' | 'workEnd' | 'dayStartHour'>,
): boolean {
  const dateKey = toDateKey(start, settings.dayStartHour)
  if (!settings.workDays.includes(weekday(dateKey))) return true
  if (toDateKey(end, settings.dayStartHour) !== dateKey) return true
  const startHm = toHHmm(start)
  const endHm = toHHmm(end)
  // Same logical day but different calendar day (e.g. 23:00 → 02:00): clock times no longer compare.
  if (endHm < startHm) return true
  return startHm < settings.workStart || endHm > settings.workEnd
}
