import { describe, expect, it } from 'vitest'
import { generateFakeData } from '../../dev/fakeData'
import { addDays } from '../date'
import { allMetrics, createMetricContext } from '../metrics'
import { DEFAULT_SETTINGS } from '../settings'
import type { Day } from '../types'
import { confidenceOf, effect, findCorrelations, pearson } from './index'

describe('effect / pearson / confidence', () => {
  it('cohen d and welch t of two groups', () => {
    // means 2 and 4, both SD 1 → d = 2
    const r = effect([1, 2, 3], [3, 4, 5])!
    expect(r.d).toBeCloseTo(2)
    expect(r.t).toBeCloseTo(2.449, 2)
  })
  it('is null when nothing varies', () => {
    expect(effect([1, 1, 1], [1, 1, 1])).toBeNull()
    expect(effect([1], [2, 3])).toBeNull()
  })
  it('pearson', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1)
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1)
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull()
  })
  it('confidence: weak / medium / strong', () => {
    expect(confidenceOf(0.6, 8, 9)).toBe('weak')
    expect(confidenceOf(0.9, 8, 9)).toBe('medium')
    expect(confidenceOf(0.6, 15, 16)).toBe('medium')
    expect(confidenceOf(-1.2, 15, 16)).toBe('strong')
  })
})

const END = '2026-10-20'

function run(days: number, seed: number, tweak?: (d: Day[]) => void) {
  const data = generateFakeData({ endKey: END, days, seed })
  tweak?.(data.days)
  const ctx = createMetricContext({
    entries: data.entries,
    days: data.days,
    habits: [],
    settings: DEFAULT_SETTINGS,
  })
  return findCorrelations(ctx, allMetrics([]), { from: addDays(END, -(days - 1)), to: END })
}

const BED_CLUSTER = [
  'bedtime',
  'sleep_midpoint',
  'wake_time',
  'sleep_hours',
  'bedtime_sd7',
  'dinner_time',
  'last_meal_to_bed',
]
const COFFEE_CLUSTER = ['last_coffee_time', 'last_coffee_to_bed', 'coffee_count']
const inCluster = (f: { factorId: string; alsoSeen: string[] }, ids: string[]) =>
  [f.factorId, ...f.alsoSeen].some((x) => ids.includes(x))

describe('findCorrelations on 60 fake days', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`seed ${seed}: finds both planted rules and at most 2 false ones`, () => {
      const out = run(60, seed)
      const energy = out.find(
        (f) => f.outcomeId === 'energy' && f.lag === 1 && inCluster(f, ['bedtime']),
      )
      const quality = out.find(
        (f) => f.outcomeId === 'sleep_quality' && f.lag === 0 && inCluster(f, ['last_coffee_time']),
      )
      expect(energy, 'early bedtime → energy next day').toBeDefined()
      expect(quality, 'late coffee → sleep quality').toBeDefined()
      // Factors that are mechanical consequences of a planted variable (e.g. work start minus last night's wake-up)
      // are the same finding in other words, not false ones.
      const related = [...BED_CLUSTER, ...COFFEE_CLUSTER, 'work_start_after_wake']
      const falseOnes = out.filter((f) => !inCluster(f, related))
      expect(
        falseOnes.map((f) => `${f.factorId}→${f.outcomeId}/${f.lag}`).length,
      ).toBeLessThanOrEqual(2)
    })
  }
})

describe('data gates', () => {
  it('reports nothing before 28 logged days, and no next-day findings before 60', () => {
    expect(run(20, 1)).toEqual([])
    const mid = run(40, 1)
    expect(mid.every((f) => f.lag === 0)).toBe(true)
  })
  it('drops sick / travel days', () => {
    const base = run(60, 1)
    expect(base.length).toBeGreaterThan(0)
    // Mark every day as sick: nothing is left to compare.
    const none = run(60, 1, (days) => days.forEach((d) => (d.dayType = 'sick')))
    expect(none).toEqual([])
  })
})
