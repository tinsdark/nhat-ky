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
  /**
   * Days with any entry. When given, a quit habit with no record on a day nothing was logged is 'rest':
   * not opening the app is not proof of no slips, so it neither extends a streak nor counts in the rate.
   */
  loggedDays?: Set<string>
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
  if (
    habit.direction === 'quit' &&
    opts.loggedDays &&
    !opts.loggedDays.has(dateKey) &&
    !values.has(dateKey)
  )
    return 'rest'
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
  const range = dateKeyRange(from < habit.startDate ? habit.startDate : from, today)
  let met = 0
  let due = 0
  const metByWeek = new Map<string, number>()
  for (const d of range) {
    const s = dayStatus(habit, d, values, opts)
    if (s === 'off' || s === 'rest') continue
    if (s === 'met') {
      met += 1
      due += 1
      const w = weekStart(d)
      metByWeek.set(w, (metByWeek.get(w) ?? 0) + 1)
    } else if (d !== today) due += 1
  }
  if (habit.schedule.kind === 'timesPerWeek') {
    // Extra days in a week do not make up for an empty week: cap each week at its target.
    const times = habit.schedule.times
    const counted = [...metByWeek.values()].reduce((sum, n) => sum + Math.min(n, times), 0)
    const expected = (times * range.length) / 7
    return expected === 0 ? null : Math.min(1, counted / expected)
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

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** "Hằng ngày", "T2–T6", "T2, T4, T6", "3 lần/tuần". */
export function describeSchedule(schedule: Habit['schedule']): string {
  if (schedule.kind === 'daily') return 'Hằng ngày'
  if (schedule.kind === 'timesPerWeek') return `${schedule.times} lần/tuần`
  const days = [...schedule.days].sort((a, b) => a - b)
  if (days.length === 7) return 'Hằng ngày'
  const contiguous = days.length > 2 && days.every((d, i) => i === 0 || d === days[i - 1]! + 1)
  return contiguous
    ? `${DAY_NAMES[days[0]!]}–${DAY_NAMES[days[days.length - 1]!]}`
    : days.map((d) => DAY_NAMES[d]).join(', ')
}

/** Unit shown next to a habit's numbers. */
export function habitUnit(h: Habit): string {
  if (h.kind === 'duration') return 'phút'
  if (h.linkedRule?.entryType === 'water') return 'ml'
  if (h.kind === 'count') return 'lần'
  return ''
}

/** "≥ 20 phút", "= 0 lần", "" for a plain yes/no habit. */
export function describeTarget(h: Habit): string {
  if (h.kind === 'check' || h.metricRule) return ''
  const unit = habitUnit(h)
  return `${h.target.op === '>=' ? '≥' : h.target.op === '<=' ? '≤' : '='} ${h.target.value}${unit ? ` ${unit}` : ''}`
}

/** 0–1 progress toward a "reach it" target; met/not-met (1 or 0) for "stay under" and "exactly" targets. */
export function habitProgress(h: Habit, value: number): number {
  if (h.target.op === '>=')
    return h.target.value <= 0 ? (value > 0 ? 1 : 0) : Math.min(1, value / h.target.value)
  return isMet(h, value) ? 1 : 0
}
