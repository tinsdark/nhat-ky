import { toHHmm } from './date'
import { isMet, isScheduled, valuesByDate } from './habits'
import type { Entry, Habit } from './types'

/** Habits the user must tick by hand: not archived, not computed from entries or a metric. */
export const isManualHabit = (h: Habit) => !h.archived && !h.linkedRule && !h.metricRule

/**
 * In-app reminders (SPEC 9.2, phương án A): habits with a `reminderTime` that has passed today, are
 * scheduled today and are not met yet. The small hours before the day rolls over count as "late".
 */
export function dueReminders(input: {
  habits: Habit[]
  todayEntries: Entry[]
  todayKey: string
  now: number
  dayStartHour: number
}): Habit[] {
  const { habits, todayEntries, todayKey, now, dayStartHour } = input
  const hhmm = toHHmm(now)
  const late = Number(hhmm.slice(0, 2)) < dayStartHour
  return habits.filter((h) => {
    if (!isManualHabit(h) || !h.reminderTime || !isScheduled(h, todayKey)) return false
    if (!late && hhmm < h.reminderTime) return false
    return !isMet(h, valuesByDate(h, todayEntries).get(todayKey) ?? 0)
  })
}
