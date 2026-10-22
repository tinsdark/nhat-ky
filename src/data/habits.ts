import { atTime, toDateKey, toHHmm, toIso } from '../core/date'
import type { Defs, Entry, Habit } from '../core/types'
import { createEntry, getDefs, saveDefs, softDeleteEntry } from './repository'
import { db } from './db'

/** One tick = one `habit` entry carrying `payload.habitId` (SPEC Module 2: ticks take part in analysis). */
export function tickHabit(
  habit: Habit,
  dateKey: string,
  dayStartHour: number,
  amount?: number,
): Promise<Entry> {
  const value = amount ?? (habit.kind === 'duration' ? habit.target.value : 1)
  // Ticks for a past day land at the same clock time of that day.
  const start =
    dateKey === toDateKey(Date.now(), dayStartHour)
      ? toIso()
      : atTime(dateKey, toHHmm(Date.now()), dayStartHour)
  return createEntry({
    type: 'habit',
    start,
    title: habit.name,
    value,
    unit: habit.kind === 'duration' ? 'phút' : '',
    payload: { habitId: habit.id },
    source: 'quick',
  })
}

/** Removes the most recent tick of the day (the "−1" / un-tick action). */
export async function untickHabit(habit: Habit, dateKey: string): Promise<void> {
  const rows = await db.entries.where('[type+dateKey]').equals(['habit', dateKey]).toArray()
  const last = rows
    .filter((e) => !e.deleted && e.payload.habitId === habit.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (last) await softDeleteEntry(last.id)
}

export async function upsertHabit(habit: Habit): Promise<void> {
  // Read and write in one transaction so a second quick save does not start from stale defs.
  await db.transaction('rw', db.defs, db.meta, async () => {
    const defs = await getDefs()
    const exists = defs.habits.some((h) => h.id === habit.id)
    const habits = exists
      ? defs.habits.map((h) => (h.id === habit.id ? habit : h))
      : [...defs.habits, habit]
    await saveDefs({ ...defs, habits } satisfies Defs)
  })
}

export function newHabitId(): string {
  return `habit-${crypto.randomUUID()}`
}
