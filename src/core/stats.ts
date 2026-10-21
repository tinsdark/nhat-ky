import { addDays, dateKeyRange, weekday } from './date'
import { mean, type MetricContext } from './metrics/context'
import type { Metric } from './metrics/definitions'

export type Point = { dateKey: string; value: number | null }

/** Mean of the non-null values of `metric` over the `days` days ending at `endKey`; null if none. */
export function windowMean(
  metric: Metric,
  ctx: MetricContext,
  endKey: string,
  days: number,
): number | null {
  const values = dateKeyRange(addDays(endKey, -(days - 1)), endKey)
    .map((d) => metric.compute(d, ctx))
    .filter((v): v is number => v !== null)
  return mean(values)
}

export interface WeekCompare {
  current: number | null
  previous: number | null
  /** Percent change vs the previous 7 days; null when either side is missing or the previous mean is 0. */
  changePct: number | null
}

/** Last 7 days (ending `today`) against the 7 days before. */
export function weekCompare(metric: Metric, ctx: MetricContext, today: string): WeekCompare {
  const current = windowMean(metric, ctx, today, 7)
  const previous = windowMean(metric, ctx, addDays(today, -7), 7)
  const changePct =
    current === null || previous === null || previous === 0
      ? null
      : ((current - previous) / Math.abs(previous)) * 100
  return { current, previous, changePct }
}

/** Trailing mean over the last `window` points, ignoring nulls; null where the window holds no value. */
export function movingAverage(points: Point[], window = 7): Point[] {
  return points.map((p, i) => ({
    dateKey: p.dateKey,
    value: mean(
      points
        .slice(Math.max(0, i - window + 1), i + 1)
        .map((q) => q.value)
        .filter((v): v is number => v !== null),
    ),
  }))
}

/** Mean value per weekday, Monday = 0 … Sunday = 6; null where that weekday has no value. */
export function byWeekday(points: Point[]): (number | null)[] {
  const buckets: number[][] = Array.from({ length: 7 }, () => [])
  for (const p of points) if (p.value !== null) buckets[weekday(p.dateKey)]!.push(p.value)
  return buckets.map(mean)
}

const HOUR_CLOCK = new Set([
  'bedtime',
  'wake_time',
  'last_coffee_time',
  'dinner_time',
  'work_start_time',
  'sleep_midpoint',
])

const pad = (n: number) => String(n).padStart(2, '0')

/** Human text for a metric value: clock times as HH:mm, ratios as %, others with a unit. */
export function formatMetric(id: string, unit: string, value: number | null): string {
  if (value === null) return '–'
  if (HOUR_CLOCK.has(id)) {
    const total = Math.round((((value % 24) + 24) % 24) * 60) % 1440
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
  }
  if (unit === '0–1') return `${Math.round(value * 100)}%`
  if (unit === '0/1') return value >= 0.5 ? 'Có' : 'Không'
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
  const short = unit.startsWith('giờ') ? 'giờ' : unit.startsWith('1–') ? '' : unit
  return short ? `${text} ${short}` : text
}
