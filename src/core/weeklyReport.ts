import { addDays, dateKeyRange } from './date'
import { dayStatus } from './habits'
import { getMetric, type MetricContext } from './metrics'
import { weekCompare, windowSum, type WeekCompare } from './stats'
import type { Habit } from './types'

export interface ReportRow extends WeekCompare {
  id: string
  label: string
  unit: string
  mode: 'mean' | 'sum'
}

export interface ReportHabit {
  name: string
  met: number
  due: number
}

export interface ReportDay {
  dateKey: string
  dayScore: number | null
  sleepHours: number | null
  mood: number | null
}

export interface WeeklyReport {
  from: string
  to: string
  loggedDays: number
  rows: ReportRow[]
  daily: ReportDay[]
  habits: ReportHabit[]
}

const ROWS: { id: string; mode: 'mean' | 'sum' }[] = [
  { id: 'sleep_hours', mode: 'mean' },
  { id: 'bedtime', mode: 'mean' },
  { id: 'wake_time', mode: 'mean' },
  { id: 'bedtime_sd7', mode: 'mean' },
  { id: 'sleep_midpoint', mode: 'mean' },
  { id: 'work_hours', mode: 'sum' },
  { id: 'deep_work_hours', mode: 'sum' },
  { id: 'overtime_hours', mode: 'sum' },
  { id: 'study_hours', mode: 'sum' },
  { id: 'exercise_min', mode: 'sum' },
  { id: 'water_ml', mode: 'mean' },
  { id: 'coffee_count', mode: 'mean' },
  { id: 'habit_rate', mode: 'mean' },
  { id: 'mood', mode: 'mean' },
  { id: 'energy', mode: 'mean' },
  { id: 'stress', mode: 'mean' },
  { id: 'focus', mode: 'mean' },
  { id: 'day_score', mode: 'mean' },
]

/** The 7 days ending `endKey`, against the 7 before: figures, per-day scores and habit completion. */
export function weeklyReport(ctx: MetricContext, endKey: string, habits: Habit[]): WeeklyReport {
  const from = addDays(endKey, -6)
  const rows = ROWS.map(({ id, mode }): ReportRow => {
    const m = getMetric(id)!
    if (mode === 'mean')
      return { id, label: m.label, unit: m.unit, mode, ...weekCompare(m, ctx, endKey) }
    const current = windowSum(m, ctx, endKey, 7)
    const previous = windowSum(m, ctx, addDays(endKey, -7), 7)
    const changePct =
      current === null || previous === null || previous === 0
        ? null
        : ((current - previous) / Math.abs(previous)) * 100
    return { id, label: m.label, unit: m.unit, mode, current, previous, changePct }
  })

  const keys = dateKeyRange(from, endKey)
  const sleep = getMetric('sleep_hours')!
  const score = getMetric('day_score')!
  const mood = getMetric('mood')!
  const daily = keys.map((dateKey) => ({
    dateKey,
    dayScore: score.compute(dateKey, ctx),
    sleepHours: sleep.compute(dateKey, ctx),
    mood: mood.compute(dateKey, ctx),
  }))

  const loggedDays = new Set(keys.filter((d) => ctx.logged(d)))
  const habitRows = habits
    .filter((h) => !h.archived)
    .map((h) => {
      const values = ctx.habitValues(h)
      const statuses = keys.map((d) => dayStatus(h, d, values, { loggedDays }))
      const met = statuses.filter((s) => s === 'met').length
      const due =
        h.schedule.kind === 'timesPerWeek'
          ? h.schedule.times
          : statuses.filter((s) => s !== 'off' && s !== 'rest').length
      return { name: h.name, met, due }
    })
    .filter((h) => h.due > 0)

  return {
    from,
    to: endKey,
    loggedDays: keys.filter((d) => ctx.logged(d)).length,
    rows,
    daily,
    habits: habitRows,
  }
}
