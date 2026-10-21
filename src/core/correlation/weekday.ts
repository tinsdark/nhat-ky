import { dateKeyRange, weekday } from '../date'
import type { Metric, MetricContext } from '../metrics'
import { countLoggedDays, readiness } from '../rules'
import type { DayType } from '../types'
import { confidenceOf, effect, type Confidence } from './engine'

export interface WeekdayFinding {
  /** Monday = 0 … Sunday = 6. */
  weekday: number
  outcomeId: string
  /** Mean outcome on that weekday and on the other days. */
  mean: number
  restMean: number
  n: number
  restN: number
  /** Cohen's d of weekday minus the rest. */
  d: number
  t: number
  confidence: Confidence
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * "Phân tích theo thứ trong tuần" (SPEC 8.1, from 60 logged days): does an outcome differ on a given
 * weekday? Same guards as the correlation engine: ≥ 7 days per group, |d| ≥ 0.5, |t| ≥ 3 (many
 * weekday × outcome pairs are tried) and both halves of the period lean the same way.
 */
export function weekdayFindings(
  ctx: MetricContext,
  outcomes: Metric[],
  opts: { from: string; to: string; excludeDayTypes?: DayType[] },
): WeekdayFinding[] {
  const { from, to } = opts
  if (readiness(countLoggedDays(ctx, to, 400)) !== 'lag') return []
  const skip = new Set<DayType>(opts.excludeDayTypes ?? ['sick', 'travel', 'holiday'])
  const keys = dateKeyRange(from, to).filter((k) => !skip.has(ctx.day(k)?.dayType as DayType))
  const mid = keys[Math.floor(keys.length / 2)]!
  const out: WeekdayFinding[] = []

  for (const y of outcomes) {
    const points = keys
      .map((k) => ({ k, w: weekday(k), v: y.compute(k, ctx) }))
      .filter((p): p is { k: string; w: number; v: number } => p.v !== null)
    for (let w = 0; w < 7; w++) {
      const mine = points.filter((p) => p.w === w)
      const rest = points.filter((p) => p.w !== w)
      if (mine.length < 7 || rest.length < 7) continue
      const stat = effect(
        rest.map((p) => p.v),
        mine.map((p) => p.v),
      )
      if (!stat || Math.abs(stat.d) < 0.5 || Math.abs(stat.t) < 3) continue
      const half = (pred: (k: string) => boolean) => {
        const a = mine.filter((p) => pred(p.k))
        const b = rest.filter((p) => pred(p.k))
        return a.length < 3 || b.length < 3
          ? null
          : mean(a.map((p) => p.v)) - mean(b.map((p) => p.v))
      }
      const first = half((k) => k < mid)
      const second = half((k) => k >= mid)
      const sign = Math.sign(stat.d)
      if (
        first === null ||
        second === null ||
        Math.sign(first) !== sign ||
        Math.sign(second) !== sign
      )
        continue
      out.push({
        weekday: w,
        outcomeId: y.id,
        mean: mean(mine.map((p) => p.v)),
        restMean: mean(rest.map((p) => p.v)),
        n: mine.length,
        restN: rest.length,
        d: stat.d,
        t: stat.t,
        confidence: confidenceOf(stat.d, mine.length, rest.length),
      })
    }
  }
  return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
}
