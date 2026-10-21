import { describe, expect, it } from 'vitest'
import { toDateKey } from '../core/date'
import { createMetricContext, getMetric } from '../core/metrics'
import { DEFAULT_SETTINGS } from '../core/settings'
import { FAKE_DEVICE, generateFakeData } from './fakeData'

describe('generateFakeData', () => {
  const a = generateFakeData({ endKey: '2026-10-20', days: 60, seed: 1 })

  it('is deterministic per seed and differs between seeds', () => {
    expect(generateFakeData({ endKey: '2026-10-20', days: 60, seed: 1 })).toEqual(a)
    expect(generateFakeData({ endKey: '2026-10-20', days: 60, seed: 2 }).entries[0]).not.toEqual(
      a.entries[0],
    )
  })

  it('covers every day, marks everything as fake, and keeps entries on their logical day', () => {
    expect(a.days).toHaveLength(60)
    for (const e of a.entries) {
      expect(e.deviceId).toBe(FAKE_DEVICE)
      expect(toDateKey(e.start, 4)).toBe(e.dateKey)
    }
  })

  it('plants the rules: early nights lift next-day energy, late coffee lowers sleep quality', () => {
    const ctx = createMetricContext({
      entries: a.entries,
      days: a.days,
      habits: [],
      settings: DEFAULT_SETTINGS,
    })
    const bed = getMetric('bedtime')!
    const energy = new Map(a.days.map((d) => [d.dateKey, d.energy!]))
    const keys = a.days.map((d) => d.dateKey)
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    const afterEarly: number[] = []
    const afterLate: number[] = []
    keys.slice(0, -1).forEach((d, i) => {
      const b = bed.compute(d, ctx)
      if (b === null) return
      ;(b < 23.5 ? afterEarly : afterLate).push(energy.get(keys[i + 1]!)!)
    })
    expect(avg(afterEarly) - avg(afterLate)).toBeGreaterThan(0.6)

    const coffee = getMetric('last_coffee_time')!
    const quality = getMetric('sleep_quality')!
    const q = (late: boolean) =>
      keys.flatMap((d) => {
        const c = coffee.compute(d, ctx)
        const v = quality.compute(d, ctx)
        return v !== null && c !== null && c >= 15 === late ? [v] : []
      })
    expect(avg(q(false)) - avg(q(true))).toBeGreaterThan(0.6)
  })

  it('a year is roughly the size the dashboard must handle', () => {
    const year = generateFakeData({ endKey: '2026-10-20', days: 365 })
    expect(year.entries.length).toBeGreaterThan(7000)
    expect(year.entries.length).toBeLessThan(15000)
  })
})
