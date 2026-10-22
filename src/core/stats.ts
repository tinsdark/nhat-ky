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
  const whole = unit === 'ml' || unit === 'phút'
  const shown = whole ? Math.round(value) : value
  const text = Number.isInteger(shown) ? String(shown) : shown.toFixed(1).replace('.', ',')
  const short = unit.startsWith('giờ') ? 'giờ' : unit.startsWith('1–') ? '' : unit
  return short ? `${text} ${short}` : text
}

const HIGHER_IS_BETTER = new Set([
  'sleep_hours',
  'sleep_quality',
  'deep_work_hours',
  'focus_avg',
  'exercise_min',
  'water_ml',
  'habit_rate',
  'mood',
  'energy',
  'focus',
  'day_score',
  'healthy_score',
  'study_hours',
])
const LOWER_IS_BETTER = new Set([
  'stress',
  'bedtime_sd7',
  'overtime_hours',
  'interruptions',
  'social_jetlag',
  'coffee_count',
])

export interface Change {
  /** "↑ +0,4 điểm", "↓ −24 phút". */
  text: string
  tone: 'good' | 'bad' | 'neutral'
}

const comma = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',')

/**
 * Change from `previous` to `current` as a plain difference in the metric's own unit (percent of a
 * 1–5 score or of a clock time means nothing). Null when either side is missing or the metric is a yes/no.
 */
export function formatChange(
  id: string,
  unit: string,
  current: number | null,
  previous: number | null,
): Change | null {
  if (current === null || previous === null || unit === '0/1') return null
  const diff = current - previous
  const sign = diff > 0 ? '+' : '−'
  const abs = Math.abs(diff)
  let body: string
  if (HOUR_CLOCK.has(id)) {
    const min = Math.round(abs * 60)
    body = min >= 60 ? `${Math.floor(min / 60)}h${pad(min % 60)}` : `${min} phút`
    if (min === 0) return { text: '→ không đổi', tone: 'neutral' }
  } else if (unit === '0–1') {
    const pts = Math.round(abs * 100)
    if (pts === 0) return { text: '→ không đổi', tone: 'neutral' }
    body = `${pts} điểm %`
  } else if (unit === 'ml' || unit === 'phút') {
    const n = Math.round(abs)
    if (n === 0) return { text: '→ không đổi', tone: 'neutral' }
    body = `${n} ${unit}`
  } else {
    if (Math.round(abs * 10) === 0) return { text: '→ không đổi', tone: 'neutral' }
    const name = unit.startsWith('giờ') ? 'giờ' : unit.startsWith('1–') ? 'điểm' : unit
    body = `${comma(abs)}${name ? ' ' + name : ''}`
  }
  const better = HIGHER_IS_BETTER.has(id) ? diff > 0 : LOWER_IS_BETTER.has(id) ? diff < 0 : null
  return {
    text: `${diff > 0 ? '↑' : '↓'} ${sign}${body}`,
    tone: better === null ? 'neutral' : better ? 'good' : 'bad',
  }
}

/** Label with its scale when the numbers are scores ("Tâm trạng (1–5)"), so "3,8" reads as 3,8 out of 5. */
export function labelWithScale(label: string, unit: string): string {
  return unit === '1–5' || unit === '1–10' ? `${label} (${unit})` : label
}

/** Sum of the non-null values of `metric` over the `days` days ending at `endKey`; null if the window has none. */
export function windowSum(
  metric: Metric,
  ctx: MetricContext,
  endKey: string,
  days: number,
): number | null {
  const values = dateKeyRange(addDays(endKey, -(days - 1)), endKey)
    .map((d) => metric.compute(d, ctx))
    .filter((v): v is number => v !== null)
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0)
}
