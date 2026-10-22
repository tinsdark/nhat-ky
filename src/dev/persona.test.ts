import { describe, expect, it } from 'vitest'
import { toDateKey, weekday } from '../core/date'
import { createMetricContext, getMetric } from '../core/metrics'
import { DEFAULT_SETTINGS } from '../core/settings'
import { FAKE_DEVICE } from './fakeData'
import { generatePersonaMonth, HYPOTHESES, OCT_2026 } from './persona'

const oct = generatePersonaMonth({
  startKey: '2026-10-01',
  days: 30,
  scenario: OCT_2026,
  nowIso: '2026-10-30T21:40:00+07:00',
})

describe('generatePersonaMonth', () => {
  it('is deterministic per seed', () => {
    const again = generatePersonaMonth({
      startKey: '2026-10-01',
      days: 30,
      scenario: OCT_2026,
      nowIso: '2026-10-30T21:40:00+07:00',
    })
    expect(again).toEqual(oct)
    expect(
      generatePersonaMonth({ startKey: '2026-10-01', days: 30, seed: 8 }).entries[0],
    ).not.toEqual(generatePersonaMonth({ startKey: '2026-10-01', days: 30, seed: 7 }).entries[0])
  })

  it('every entry is fake, on its logical day, and nothing exists after "now"', () => {
    for (const e of oct.entries) {
      expect(e.deviceId).toBe(FAKE_DEVICE)
      expect(toDateKey(e.start, 4)).toBe(e.dateKey)
      expect(Date.parse(e.start)).toBeLessThanOrEqual(Date.parse('2026-10-30T21:40:00+07:00'))
    }
    expect(oct.days).toHaveLength(29) // the day in progress has no rating yet
  })

  it('marks the scripted sick and travel days', () => {
    const type = (k: string) => oct.days.find((d) => d.dateKey === k)?.dayType
    expect(type('2026-10-08')).toBe('sick')
    expect(type('2026-10-17')).toBe('travel')
    expect(type('2026-10-14')).toBeNull()
  })

  it('has no work on weekends, sick or travel days', () => {
    for (const e of oct.entries.filter((x) => x.type === 'work')) {
      expect(weekday(e.dateKey)).toBeLessThan(5)
      expect(['2026-10-08', '2026-10-09']).not.toContain(e.dateKey)
    }
  })

  it('lists 18 hypotheses with unique ids', () => {
    expect(new Set(HYPOTHESES.map((h) => h.id)).size).toBe(18)
  })
})

describe('the hypotheses show up in a long run', () => {
  const long = generatePersonaMonth({ startKey: '2026-01-01', days: 400, seed: 11 })
  const ctx = createMetricContext({
    entries: long.entries,
    days: long.days,
    habits: [],
    settings: DEFAULT_SETTINGS,
  })
  const keys = long.days.map((d) => d.dateKey)
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const sleepQ = getMetric('sleep_quality')!
  const split = (cond: (k: string) => boolean | null, f: (k: string) => number | null) => {
    const a: number[] = []
    const b: number[] = []
    for (const k of keys) {
      const c = cond(k)
      const v = f(k)
      if (c === null || v === null) continue
      ;(c ? a : b).push(v)
    }
    return mean(a) - mean(b)
  }

  it('H2: late coffee lowers that night’s sleep quality', () => {
    const coffee = getMetric('last_coffee_time')!
    const diff = split(
      (k) => {
        const c = coffee.compute(k, ctx)
        return c === null ? false : c >= 15
      },
      (k) => sleepQ.compute(k, ctx),
    )
    expect(diff).toBeLessThan(-0.4)
  })

  it('H1: weekend nights start later than weekday nights', () => {
    const bed = getMetric('bedtime')!
    const norm = (h: number) => (h < 12 ? h + 24 : h)
    const diff = split(
      (k) => weekday(k) >= 5,
      (k) => {
        const v = bed.compute(k, ctx)
        return v === null ? null : norm(v)
      },
    )
    expect(diff).toBeGreaterThan(0.4)
  })

  it('H7: a longer night is followed by a higher energy day', () => {
    const dur = getMetric('sleep_hours')!
    const energy = new Map(long.days.map((d) => [d.dateKey, d.energy]))
    const xs: number[] = []
    const ys: number[] = []
    keys.slice(0, -1).forEach((k, i) => {
      const h = dur.compute(k, ctx)
      const e = energy.get(keys[i + 1]!)
      if (h !== null && e != null) {
        xs.push(h)
        ys.push(e)
      }
    })
    const mx = mean(xs)
    const my = mean(ys)
    const cov = mean(xs.map((x, i) => (x - mx) * (ys[i]! - my)))
    const r =
      cov / Math.sqrt(mean(xs.map((x) => (x - mx) ** 2)) * mean(ys.map((y) => (y - my) ** 2)))
    expect(r).toBeGreaterThan(0.25)
  })
})
