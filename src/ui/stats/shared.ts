import type { Metric, MetricContext } from '../../core/metrics'
import type { Day, Defs, Entry, Settings } from '../../core/types'

/** Everything a Thống kê tab needs, loaded once by the shell. */
export interface StatsData {
  ctx: MetricContext
  metrics: Metric[]
  today: string
  settings: Settings
  defs: Defs
  entries: Entry[]
  days: Day[]
}

/** Days of history the shell loads (90-day trend + one week to compare). */
export const HISTORY_DAYS = 97
