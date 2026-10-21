import { describe, expect, it } from 'vitest'
import { generateFakeData } from '../../dev/fakeData'
import { addDays, weekday } from '../date'
import { weekdayCandidates } from '../insights'
import { allMetrics, createMetricContext } from '../metrics'
import { DEFAULT_SETTINGS } from '../settings'
import type { Day } from '../types'
import { weekdayFindings } from './index'

const END = '2026-10-20'
const metrics = allMetrics([])
const outcomes = metrics.filter((m) => ['day_score', 'mood', 'energy'].includes(m.id))

function run(days: number, seed: number, tweak?: (d: Day[]) => void) {
  const data = generateFakeData({ endKey: END, days, seed })
  tweak?.(data.days)
  const ctx = createMetricContext({
    entries: data.entries,
    days: data.days,
    habits: [],
    settings: DEFAULT_SETTINGS,
  })
  return {
    ctx,
    found: weekdayFindings(ctx, outcomes, { from: addDays(END, -(days - 1)), to: END }),
  }
}

describe('weekdayFindings', () => {
  it('finds a planted weekday effect (Mondays score low) and reports it as information', () => {
    const { found } = run(90, 3, (days) =>
      days.forEach((d) => {
        if (weekday(d.dateKey) === 0) d.dayScore = 3 + (d.dateKey.charCodeAt(9) % 2)
      }),
    )
    const monday = found.find((f) => f.weekday === 0 && f.outcomeId === 'day_score')
    expect(monday).toBeDefined()
    expect(monday!.d).toBeLessThan(0)
    expect(monday!.mean).toBeLessThan(monday!.restMean)
    const [c] = weekdayCandidates([monday!], metrics)
    expect(c!.kind).toBe('weekday:0>day_score')
    expect(c!.text).toContain('Thứ Hai: Điểm ngày TB')
    expect(c!.text).toContain('chỉ để tham khảo')
    expect(c!.action).toBeNull()
  })
  it('stays quiet on random data (at most 1 false finding over several seeds)', () => {
    for (const seed of [1, 2, 4, 5, 6, 7]) {
      expect(run(90, seed).found.length, `seed ${seed}`).toBeLessThanOrEqual(1)
    }
  })
  it('needs 60 logged days', () => {
    expect(
      run(45, 3, (days) =>
        days.forEach((d) => {
          if (weekday(d.dateKey) === 0) d.dayScore = 1
        }),
      ).found,
    ).toEqual([])
  })
})
