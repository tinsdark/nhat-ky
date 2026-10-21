import { dateKeyRange } from '../date'
import type { Habit } from '../types'
import { habitMetrics, METRICS, type Metric } from './definitions'
import type { MetricContext } from './context'

export { createMetricContext } from './context'
export type { MetricContext, MetricInput } from './context'
export { habitMetrics, METRICS } from './definitions'
export type { Metric, MetricGroup } from './definitions'

/** Static metrics plus one per habit. */
export function allMetrics(habits: Habit[]): Metric[] {
  return [...METRICS, ...habitMetrics(habits)]
}

export function getMetric(id: string, habits: Habit[] = []): Metric | undefined {
  return allMetrics(habits).find((m) => m.id === id)
}

/** One value per day in [from, to], null where the day has no data. */
export function computeSeries(
  metric: Metric,
  ctx: MetricContext,
  from: string,
  to: string,
): { dateKey: string; value: number | null }[] {
  return dateKeyRange(from, to).map((dateKey) => ({ dateKey, value: metric.compute(dateKey, ctx) }))
}
