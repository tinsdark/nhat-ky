import { addDays, dateKeyRange } from '../date'
import { countLoggedDays, readiness } from '../rules'
import type { MetricContext } from '../metrics'
import type { Metric } from '../metrics'
import type { DayType } from '../types'

/** Outcome (Y) metrics the engine tries to explain. */
export const OUTCOME_IDS = [
  'day_score',
  'mood',
  'energy',
  'focus',
  'sleep_quality',
  'deep_work_hours',
] as const

/** Factors that are part of (or restate) an outcome, so comparing them proves nothing. */
const NOT_FACTORS: Record<string, string[]> = {
  deep_work_hours: [
    'work_hours',
    'overtime_hours',
    'work_start_time',
    'work_start_after_wake',
    'focus_avg',
    'interruptions',
  ],
  focus: ['focus_avg'],
}

/**
 * Factors read off "the night that starts on day d" (or the evening of d). That night comes after the
 * day's mood/score/focus are rated, so a same-day pairing would run cause and effect backwards: these
 * are only paired with the next day's outcome (SPEC 8.3). Exception: the sleep quality of that same night.
 */
const NIGHT_FACTORS = new Set([
  'bedtime',
  'wake_time',
  'sleep_hours',
  'bedtime_sd7',
  'screen_before_bed',
  'sleep_midpoint',
  'social_jetlag',
  'last_meal_to_bed',
  'last_coffee_to_bed',
  'late_eating',
])

export type Confidence = 'weak' | 'medium' | 'strong'

export interface Finding {
  factorId: string
  outcomeId: string
  /** 0 = same day, 1 = the factor's day against the next day's outcome. */
  lag: 0 | 1
  kind: 'binary' | 'tertile'
  nLow: number
  nHigh: number
  /** Mean outcome in the low group (binary: factor = 0; tertile: lowest third of the factor). */
  meanLow: number
  meanHigh: number
  /** For tertile findings: factor range of each group. */
  lowMax: number | null
  highMin: number | null
  /** Cohen's d of high minus low; positive = the outcome is higher with more of the factor. */
  d: number
  /** Welch t statistic of the same difference. */
  t: number
  confidence: Confidence
  /** Other factors that moved together with this one (|r| ≥ 0.7) and were folded into it. */
  alsoSeen: string[]
}

export interface Options {
  from: string
  to: string
  /** Pairs of the same kind below this size per group are skipped. */
  minGroup?: number
  minAbsD?: number
  /** Guard against the many-comparisons problem: a Welch |t| below this is not reported. */
  minAbsT?: number
  /** Factors whose series correlate at least this much are reported as one finding. */
  clusterR?: number
  excludeDayTypes?: DayType[]
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const variance = (xs: number[]) => {
  const m = mean(xs)
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
}

/** Cohen's d (pooled SD) and Welch t of `b` minus `a`. Null when neither group varies. */
export function effect(a: number[], b: number[]): { d: number; t: number } | null {
  if (a.length < 2 || b.length < 2) return null
  const va = variance(a)
  const vb = variance(b)
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2))
  const se = Math.sqrt(va / a.length + vb / b.length)
  if (pooled === 0 || se === 0) return null
  const diff = mean(b) - mean(a)
  return { d: diff / pooled, t: diff / se }
}

export function pearson(x: number[], y: number[]): number | null {
  if (x.length < 3) return null
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my)
    sxx += (x[i]! - mx) ** 2
    syy += (y[i]! - my) ** 2
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy)
}

interface Pair {
  index: number
  dateKey: string
  x: number
  y: number
}

interface Candidate extends Omit<Finding, 'alsoSeen'> {
  /** Factor value per dateKey, for clustering. */
  xByDate: Map<string, number>
}

/** Confidence labels (SPEC 8.3): medium = d ≥ 0.8 or both groups ≥ 15 days; strong = both. */
export function confidenceOf(d: number, nLow: number, nHigh: number): Confidence {
  const big = Math.abs(d) >= 0.8
  const many = nLow >= 15 && nHigh >= 15
  return big && many ? 'strong' : big || many ? 'medium' : 'weak'
}

function groups(pairs: Pair[], minGroup: number) {
  const binary = pairs.every((p) => p.x === 0 || p.x === 1)
  if (binary) {
    const low = pairs.filter((p) => p.x === 0)
    const high = pairs.filter((p) => p.x === 1)
    return low.length >= minGroup && high.length >= minGroup
      ? { kind: 'binary' as const, low, high }
      : null
  }
  const sorted = [...pairs].sort((a, b) => a.x - b.x)
  const third = Math.floor(sorted.length / 3)
  if (third < minGroup) return null
  const low = sorted.slice(0, third)
  const high = sorted.slice(sorted.length - third)
  return low[low.length - 1]!.x < high[0]!.x ? { kind: 'tertile' as const, low, high } : null
}

/** Both halves of the period (by date) must show the same direction as the whole. */
function halvesAgree(pairs: Pair[], low: Pair[], high: Pair[], sign: number): boolean {
  const mid = pairs[Math.floor(pairs.length / 2)]!.dateKey
  const diff = (half: (p: Pair) => boolean) => {
    const a = low.filter(half)
    const b = high.filter(half)
    if (a.length < 3 || b.length < 3) return null
    return mean(b.map((p) => p.y)) - mean(a.map((p) => p.y))
  }
  const first = diff((p) => p.dateKey < mid)
  const second = diff((p) => p.dateKey >= mid)
  return (
    first !== null && second !== null && Math.sign(first) === sign && Math.sign(second) === sign
  )
}

/**
 * Looks for factors that go with better or worse days (SPEC 8.3). Same-day pairs need 28 logged days,
 * next-day pairs 60. Filters: each group ≥ minGroup days, |d| ≥ minAbsD, |t| ≥ minAbsT, both halves of
 * the period agree, sick/travel/holiday days dropped. Factors that move together are folded into
 * the strongest one. Sorted by confidence then |d|.
 */
export function findCorrelations(ctx: MetricContext, metrics: Metric[], opts: Options): Finding[] {
  const { from, to } = opts
  const minGroup = opts.minGroup ?? 7
  const minAbsD = opts.minAbsD ?? 0.5
  const minAbsT = opts.minAbsT ?? 3.5
  const clusterR = opts.clusterR ?? 0.7
  const skip = new Set<DayType>(opts.excludeDayTypes ?? ['sick', 'travel', 'holiday'])

  const level = readiness(countLoggedDays(ctx, to, 400))
  if (level === 'describe' || level === 'rules') return []
  const lags: (0 | 1)[] = level === 'lag' ? [0, 1] : [0]

  const keys = dateKeyRange(from, to)
  const excluded = new Set(keys.filter((k) => skip.has(ctx.day(k)?.dayType as DayType)))
  const series = new Map<string, (number | null)[]>()
  const seriesOf = (m: Metric) => {
    let s = series.get(m.id)
    if (!s) series.set(m.id, (s = keys.map((k) => m.compute(k, ctx))))
    return s
  }

  const outcomeSet = new Set<string>(OUTCOME_IDS)
  const outcomes = metrics.filter((m) => outcomeSet.has(m.id))
  const factors = metrics.filter((m) => !outcomeSet.has(m.id))

  const found: Finding[] = []
  for (const y of outcomes) {
    for (const lag of lags) {
      const candidates: Candidate[] = []
      const ys = seriesOf(y)
      for (const f of factors) {
        if (NOT_FACTORS[y.id]?.includes(f.id)) continue
        if (lag === 0 && y.id !== 'sleep_quality' && NIGHT_FACTORS.has(f.id)) continue
        const xs = seriesOf(f)
        const pairs: Pair[] = []
        for (let i = 0; i + lag < keys.length; i++) {
          const x = xs[i]
          const yv = ys[i + lag]
          if (x === null || x === undefined || yv === null || yv === undefined) continue
          if (excluded.has(keys[i]!) || excluded.has(keys[i + lag]!)) continue
          pairs.push({ index: i, dateKey: keys[i]!, x, y: yv })
        }
        const g = groups(pairs, minGroup)
        if (!g) continue
        const stat = effect(
          g.low.map((p) => p.y),
          g.high.map((p) => p.y),
        )
        if (!stat || Math.abs(stat.d) < minAbsD || Math.abs(stat.t) < minAbsT) continue
        if (!halvesAgree(pairs, g.low, g.high, Math.sign(stat.d))) continue
        candidates.push({
          factorId: f.id,
          outcomeId: y.id,
          lag,
          kind: g.kind,
          nLow: g.low.length,
          nHigh: g.high.length,
          meanLow: mean(g.low.map((p) => p.y)),
          meanHigh: mean(g.high.map((p) => p.y)),
          lowMax: g.kind === 'tertile' ? g.low[g.low.length - 1]!.x : null,
          highMin: g.kind === 'tertile' ? g.high[0]!.x : null,
          d: stat.d,
          t: stat.t,
          confidence: confidenceOf(stat.d, g.low.length, g.high.length),
          xByDate: new Map(pairs.map((p) => [p.dateKey, p.x])),
        })
      }

      // Fold factors that move together into the strongest one.
      candidates.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      const kept: { c: Candidate; also: string[] }[] = []
      for (const c of candidates) {
        const twin = kept.find(({ c: k }) => {
          const common = [...c.xByDate.keys()].filter((d) => k.xByDate.has(d))
          const r = pearson(
            common.map((d) => c.xByDate.get(d)!),
            common.map((d) => k.xByDate.get(d)!),
          )
          return r !== null && Math.abs(r) >= clusterR
        })
        if (twin) twin.also.push(c.factorId)
        else kept.push({ c, also: [] })
      }
      for (const { c, also } of kept) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { xByDate, ...finding } = c
        found.push({ ...finding, alsoSeen: also })
      }
    }
  }

  const rank = { strong: 3, medium: 2, weak: 1 }
  return found.sort(
    (a, b) => rank[b.confidence] - rank[a.confidence] || Math.abs(b.d) - Math.abs(a.d),
  )
}

/** Convenience: the window used by the app, the last `days` days ending `today`. */
export function lookback(today: string, days = 180): { from: string; to: string } {
  return { from: addDays(today, -(days - 1)), to: today }
}
