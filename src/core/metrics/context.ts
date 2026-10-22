import { addDays, dateKeyRange, toHHmm } from '../date'
import { valuesByDate } from '../habits'
import type { Day, Entry, Habit, Settings } from '../types'

/** Metric lookup for habits that follow a metric. Registered by metrics/index.ts, which owns the registry. */
type MetricLookup = (
  id: string,
) => { compute(dateKey: string, ctx: MetricContext): number | null } | undefined
let lookupMetric: MetricLookup = () => undefined
export function setMetricLookup(fn: MetricLookup): void {
  lookupMetric = fn
}

export interface MetricInput {
  entries: Entry[]
  days: Day[]
  habits: Habit[]
  settings: Settings
}

/** Read-only view over a block of data, shared by every metric so lookups are indexed once. */
export interface MetricContext {
  settings: Settings
  habits: Habit[]
  /** Live entries of a logical day. */
  entriesOf(dateKey: string): Entry[]
  /** Every dateKey that has at least one entry, sorted. */
  dateKeys(): string[]
  day(dateKey: string): Day | undefined
  /** True when anything was recorded that day. A day with nothing is "not logged": metrics return null, not 0. */
  logged(dateKey: string): boolean
  /**
   * The night that starts on this logical day: its longest finished non-nap sleep. A sleep belongs to
   * the day it starts, so the wake-up lands on the next calendar morning.
   */
  nightSleep(dateKey: string): Entry | null
  /** Per-day values of a habit over the whole input, cached. */
  habitValues(habit: Habit): Map<string, number>
}

export function createMetricContext(input: MetricInput): MetricContext {
  const byDate = new Map<string, Entry[]>()
  for (const e of input.entries) {
    if (e.deleted) continue
    const list = byDate.get(e.dateKey)
    if (list) list.push(e)
    else byDate.set(e.dateKey, [e])
  }
  for (const list of byDate.values()) list.sort((a, b) => a.start.localeCompare(b.start))
  const days = new Map(input.days.filter((d) => !d.deleted).map((d) => [d.dateKey, d]))
  const live = [...byDate.values()].flat()
  const habitCache = new Map<string, Map<string, number>>()

  const entriesOf = (dateKey: string) => byDate.get(dateKey) ?? []

  /** 1 on days the metric passes the test, 0 when it does not, absent when the metric has no value. */
  function metricRuleValues(habit: Habit): Map<string, number> {
    const rule = habit.metricRule!
    const out = new Map<string, number>()
    const metric = lookupMetric(rule.metricId)
    const keys = [...byDate.keys(), ...days.keys()].sort()
    if (!metric || keys.length === 0) return out
    for (const d of dateKeyRange(
      habit.startDate < keys[0]! ? habit.startDate : keys[0]!,
      keys[keys.length - 1]!,
    )) {
      const v = metric.compute(rule.previousNight ? addDays(d, -1) : d, ctx)
      if (v === null) continue
      out.set(d, (rule.op === '<=' ? v <= rule.value : v >= rule.value) ? 1 : 0)
    }
    return out
  }

  const ctx: MetricContext = {
    settings: input.settings,
    habits: input.habits,
    entriesOf,
    dateKeys: () => [...byDate.keys()].sort(),
    day: (dateKey) => days.get(dateKey),
    logged: (dateKey) => entriesOf(dateKey).length > 0,
    nightSleep(dateKey) {
      let best: Entry | null = null
      let bestMs = -1
      for (const e of entriesOf(dateKey)) {
        if (e.type !== 'sleep' || e.payload.nap === true || e.end === null) continue
        const ms = new Date(e.end).getTime() - new Date(e.start).getTime()
        if (ms > bestMs) {
          best = e
          bestMs = ms
        }
      }
      return best
    },
    habitValues(habit) {
      let v = habitCache.get(habit.id)
      if (!v) {
        v = habit.metricRule ? metricRuleValues(habit) : valuesByDate(habit, live)
        habitCache.set(habit.id, v)
      }
      return v
    },
  }
  return ctx
}

/** Clock hour 0–24 (Vietnam time) with decimals. */
export function clockHours(ts: string): number {
  const [h, m] = toHHmm(ts).split(':').map(Number) as [number, number]
  return h + m / 60
}

/** Clock hour that keeps late-night times past 24 (00:30 → 24.5) so bedtimes around midnight average correctly. */
export function nightHours(ts: string): number {
  const h = clockHours(ts)
  return h < 12 ? h + 24 : h
}

/**
 * Clock hour on the logical day: times before `dayStartHour` belong to the previous day, so they come
 * out past 24 (01:00 with a 04:00 day start → 25), not as an early-morning 1.0.
 */
export function dayHours(ts: string, dayStartHour: number): number {
  const h = clockHours(ts)
  return h < dayStartHour ? h + 24 : h
}

export const hoursBetween = (a: string, b: string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000

/** Hours of a finished block; open blocks count as 0. */
export const blockHours = (e: Entry) => (e.end ? Math.max(0, hoursBetween(e.start, e.end)) : 0)

export const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length

/** Population standard deviation, null below `minCount` values. */
export function stdDev(xs: number[], minCount = 3): number | null {
  if (xs.length < minCount) return null
  const m = mean(xs)!
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length)
}
