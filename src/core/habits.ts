import { addDays, dateKeyRange, weekday } from './date'
import type { DayType, Entry, Habit } from './types'

export type DayStatus =
  /** Target reached. */
  | 'met'
  /** Something recorded for a build habit, below target. */
  | 'partial'
  /** Scheduled and not reached. */
  | 'missed'
  /** Not scheduled that day (or before the habit started). */
  | 'off'
  /** sick / travel day, skipped on request. */
  | 'rest'

export interface HabitOptions {
  /** Days with dayType sick or travel neither break a streak nor count against the rate. */
  skipRestDays?: boolean
  dayTypes?: Map<string, DayType | null>
}

/** Minutes of a block; open blocks count as 0. */
const minutesOf = (e: Entry) =>
  e.end
    ? Math.max(0, Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60_000))
    : 0

/**
 * Per-day value of a habit: a linked rule sums the matching entries (value, or minutes for
 * blocks without a value); otherwise it sums the ticks (`type = habit`, `payload.habitId`), where a
 * tick without a value counts as 1. Days with nothing recorded are absent from the map.
 */
export function valuesByDate(habit: Habit, entries: Entry[]): Map<string, number> {
  const out = new Map<string, number>()
  const add = (dateKey: string, n: number) => out.set(dateKey, (out.get(dateKey) ?? 0) + n)
  for (const e of entries) {
    if (e.deleted) continue
    if (habit.linkedRule) {
      const rule = habit.linkedRule
      if (e.type !== rule.entryType) continue
      if (rule.categoryId && e.categoryId !== rule.categoryId) continue
      add(e.dateKey, e.value ?? minutesOf(e))
    } else if (e.type === 'habit' && e.payload.habitId === habit.id) {
      add(e.dateKey, e.value ?? 1)
    }
  }
  return out
}

export function isMet(habit: Habit, value: number): boolean {
  const { op, value: target } = habit.target
  if (op === '>=') return value >= target
  if (op === '<=') return value <= target
  return value === target
}

export function isScheduled(habit: Habit, dateKey: string): boolean {
  if (dateKey < habit.startDate) return false
  const s = habit.schedule
  if (s.kind === 'weekdays') return s.days.includes(weekday(dateKey))
  return true
}

const isRest = (dateKey: string, opts: HabitOptions) => {
  if (!opts.skipRestDays) return false
  const t = opts.dayTypes?.get(dateKey)
  return t === 'sick' || t === 'travel'
}

export function dayStatus(
  habit: Habit,
  dateKey: string,
  values: Map<string, number>,
  opts: HabitOptions = {},
): DayStatus {
  if (!isScheduled(habit, dateKey)) return 'off'
  if (isRest(dateKey, opts)) return 'rest'
  // A quit habit with no record means no slips; a build habit with no record means nothing done.
  const value = values.get(dateKey) ?? 0
  if (isMet(habit, value)) return 'met'
  return habit.direction === 'build' && value > 0 ? 'partial' : 'missed'
}

export const weekStart = (dateKey: string) => addDays(dateKey, -weekday(dateKey))

function weekMetCounts(
  habit: Habit,
  values: Map<string, number>,
  today: string,
  opts: HabitOptions,
) {
  const counts = new Map<string, number>()
  for (const d of dateKeyRange(weekStart(habit.startDate), today)) {
    const w = weekStart(d)
    if (!counts.has(w)) counts.set(w, 0)
    if (dayStatus(habit, d, values, opts) === 'met') counts.set(w, counts.get(w)! + 1)
  }
  return counts
}

export interface Streaks {
  /** Days in a row, or weeks in a row for a "x times a week" habit. */
  current: number
  longest: number
}

export function streaks(
  habit: Habit,
  values: Map<string, number>,
  today: string,
  opts: HabitOptions = {},
): Streaks {
  if (today < habit.startDate) return { current: 0, longest: 0 }

  if (habit.schedule.kind === 'timesPerWeek') {
    const need = habit.schedule.times
    const counts = weekMetCounts(habit, values, today, opts)
    const thisWeek = weekStart(today)
    let run = 0
    let longest = 0
    for (const [w, n] of counts) {
      if (n >= need) {
        run += 1
        longest = Math.max(longest, run)
      } else if (w !== thisWeek) run = 0 // the running week is still open
    }
    const weeks = [...counts.keys()].reverse()
    let current = 0
    for (const w of weeks) {
      if ((counts.get(w) ?? 0) >= need) current += 1
      else if (w !== thisWeek) break
    }
    return { current, longest }
  }

  const days = dateKeyRange(habit.startDate, today)
  let run = 0
  let longest = 0
  for (const d of days) {
    const s = dayStatus(habit, d, values, opts)
    if (s === 'met') {
      run += 1
      longest = Math.max(longest, run)
    } else if ((s === 'missed' || s === 'partial') && d !== today) run = 0
  }
  let current = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!
    const s = dayStatus(habit, d, values, opts)
    if (s === 'met') current += 1
    else if ((s === 'missed' || s === 'partial') && d !== today) break
  }
  return { current, longest }
}

/**
 * Share of scheduled days met over the last `windowDays` days ending today, or null when no day
 * is due yet. Today only counts once met. For "x times a week" the expectation is x per 7 days.
 */
export function completionRate(
  habit: Habit,
  values: Map<string, number>,
  today: string,
  windowDays: number,
  opts: HabitOptions = {},
): number | null {
  const from = addDays(today, -(windowDays - 1))
  let met = 0
  let due = 0
  for (const d of dateKeyRange(from < habit.startDate ? habit.startDate : from, today)) {
    const s = dayStatus(habit, d, values, opts)
    if (s === 'off' || s === 'rest') continue
    if (s === 'met') {
      met += 1
      due += 1
    } else if (d !== today) due += 1
  }
  if (habit.schedule.kind === 'timesPerWeek') {
    const days = dateKeyRange(from < habit.startDate ? habit.startDate : from, today).length
    const expected = (habit.schedule.times * days) / 7
    return expected === 0 ? null : Math.min(1, met / expected)
  }
  return due === 0 ? null : met / due
}

export interface HeatCell {
  dateKey: string
  status: DayStatus | 'future'
}

/** `weeks` columns (Monday first) ending with the week of `today`. */
export function heatmap(
  habit: Habit,
  values: Map<string, number>,
  today: string,
  weeks = 12,
  opts: HabitOptions = {},
): HeatCell[][] {
  const first = addDays(weekStart(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const dateKey = addDays(first, w * 7 + d)
      return {
        dateKey,
        status: dateKey > today ? ('future' as const) : dayStatus(habit, dateKey, values, opts),
      }
    }),
  )
}
