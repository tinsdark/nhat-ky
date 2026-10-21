import { toDateKey, toHHmm, weekday } from './date'
import type { Settings } from './types'

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
