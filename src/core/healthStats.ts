import { addDays, dateKeyRange } from './date'
import { clockHours, type MetricContext } from './metrics/context'
import { getMetric } from './metrics'
import { weekCompare, windowSum, type WeekCompare } from './stats'

export interface SleepBar {
  dateKey: string
  /** Hours after 18:00 that the night started and ended (so 23:30 → 5.5, 07:00 → 13). */
  startH: number
  endH: number
  quality: number | null
}

const sinceEvening = (h: number) => (h >= 18 ? h - 18 : h + 6)

/** One bar per night with a finished sleep, for the 30-day chart. Nights are filed under the day they start. */
export function sleepBars(ctx: MetricContext, from: string, to: string): SleepBar[] {
  const bars: SleepBar[] = []
  for (const dateKey of dateKeyRange(from, to)) {
    const night = ctx.nightSleep(dateKey)
    if (!night) continue
    const startH = sinceEvening(clockHours(night.start))
    const hours = (new Date(night.end!).getTime() - new Date(night.start).getTime()) / 3_600_000
    const q = night.payload.quality
    bars.push({ dateKey, startH, endH: startH + hours, quality: typeof q === 'number' ? q : null })
  }
  return bars
}

export interface HealthCard extends WeekCompare {
  id: string
  label: string
  unit: string
  /** `sum` cards add the days up (exercise minutes); the others average them. */
  mode: 'mean' | 'sum'
}

/** Weekly summary of SPEC 5.4: sleep, regularity, exercise minutes, mood — this week against the one before. */
export function healthWeek(ctx: MetricContext, today: string): HealthCard[] {
  const spec: { id: string; mode: 'mean' | 'sum' }[] = [
    { id: 'sleep_hours', mode: 'mean' },
    { id: 'bedtime_sd7', mode: 'mean' },
    { id: 'exercise_min', mode: 'sum' },
    { id: 'mood', mode: 'mean' },
    { id: 'energy', mode: 'mean' },
    { id: 'day_score', mode: 'mean' },
  ]
  return spec.map(({ id, mode }) => {
    const m = getMetric(id)!
    if (mode === 'mean')
      return { id, label: m.label, unit: m.unit, mode, ...weekCompare(m, ctx, today) }
    const current = windowSum(m, ctx, today, 7)
    const previous = windowSum(m, ctx, addDays(today, -7), 7)
    const changePct =
      current === null || previous === null || previous === 0
        ? null
        : ((current - previous) / Math.abs(previous)) * 100
    return { id, label: m.label, unit: m.unit, mode, current, previous, changePct }
  })
}

export interface EnergyPoint {
  hour: number
  mean: number | null
  n: number
}

/** Mean energy of the quick check-ins by clock hour over the last `days` days (SPEC 5.5). */
export function energyCurve(ctx: MetricContext, today: string, days = 30): EnergyPoint[] {
  const sum = Array<number>(24).fill(0)
  const n = Array<number>(24).fill(0)
  for (const d of dateKeyRange(addDays(today, -(days - 1)), today)) {
    for (const e of ctx.entriesOf(d)) {
      const energy = (e.payload.checkin as { energy?: unknown } | undefined)?.energy
      if (e.type !== 'note' || typeof energy !== 'number') continue
      const h = Math.floor(clockHours(e.start))
      sum[h]! += energy
      n[h]! += 1
    }
  }
  return sum.map((s, hour) => ({ hour, mean: n[hour]! > 0 ? s / n[hour]! : null, n: n[hour]! }))
}

export interface EnergyHighlights {
  peak: number
  dip: number
  spread: number
}

/**
 * Best and worst hour among hours with at least `minSamples` check-ins. Null until three such hours
 * exist, or when the hours barely differ (spread under 0.5 point): nothing worth saying.
 */
export function energyHighlights(curve: EnergyPoint[], minSamples = 3): EnergyHighlights | null {
  const usable = curve.filter(
    (p): p is EnergyPoint & { mean: number } => p.mean !== null && p.n >= minSamples,
  )
  if (usable.length < 3) return null
  const peak = usable.reduce((a, b) => (b.mean > a.mean ? b : a))
  const dip = usable.reduce((a, b) => (b.mean < a.mean ? b : a))
  const spread = peak.mean - dip.mean
  return spread < 0.5 ? null : { peak: peak.hour, dip: dip.hour, spread }
}
