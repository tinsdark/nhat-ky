import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import { createMetricContext } from './metrics'
import type { Metric } from './metrics'
import { byWeekday, formatMetric, movingAverage, weekCompare, windowMean } from './stats'

// A metric whose value for a day is looked up from a table, so expectations are plain arithmetic.
function table(values: Record<string, number | null>): Metric {
  return { id: 't', label: 't', unit: '', group: 'mind', compute: (d) => values[d] ?? null }
}
const ctx = createMetricContext({ entries: [], days: [], habits: [], settings: DEFAULT_SETTINGS })

describe('weekCompare', () => {
  // today 2026-11-14: current = 11-08..11-14, previous = 11-01..11-07
  const values: Record<string, number | null> = {}
  for (const d of ['08', '09', '10', '11']) values[`2026-11-${d}`] = 8 // 4 values, mean 8
  for (const d of ['01', '02', '03', '04', '05']) values[`2026-11-${d}`] = d === '05' ? null : 6 // 4 values, mean 6
  it('compares means of non-null days and gives % change', () => {
    const r = weekCompare(table(values), ctx, '2026-11-14')
    expect(r.current).toBe(8)
    expect(r.previous).toBe(6)
    expect(r.changePct).toBeCloseTo(33.333, 2)
  })
  it('returns null change when a side is empty or the previous mean is 0', () => {
    expect(weekCompare(table({}), ctx, '2026-11-14')).toEqual({
      current: null,
      previous: null,
      changePct: null,
    })
    const zero = weekCompare(table({ '2026-11-01': 0, '2026-11-10': 5 }), ctx, '2026-11-14')
    expect(zero.changePct).toBeNull()
  })
})

describe('windowMean', () => {
  it('ignores nulls rather than counting them as 0', () => {
    expect(windowMean(table({ '2026-11-14': 10, '2026-11-12': 4 }), ctx, '2026-11-14', 7)).toBe(7)
  })
})

describe('movingAverage', () => {
  it('averages the trailing window and skips nulls', () => {
    const pts = [2, 4, null, 6].map((value, i) => ({ dateKey: `2026-11-0${i + 1}`, value }))
    expect(movingAverage(pts, 3).map((p) => p.value)).toEqual([2, 3, 3, 5])
  })
  it('is null while the window has no value', () => {
    const pts = [null, null, 5].map((value, i) => ({ dateKey: `2026-11-0${i + 1}`, value }))
    expect(movingAverage(pts, 2).map((p) => p.value)).toEqual([null, null, 5])
  })
})

describe('byWeekday', () => {
  it('buckets Monday-first and averages', () => {
    // 2026-11-02 Mon, 11-09 Mon, 11-04 Wed
    const pts = [
      { dateKey: '2026-11-02', value: 4 },
      { dateKey: '2026-11-09', value: 6 },
      { dateKey: '2026-11-04', value: 3 },
      { dateKey: '2026-11-05', value: null },
    ]
    expect(byWeekday(pts)).toEqual([5, null, 3, null, null, null, null])
  })
})

describe('formatMetric', () => {
  it('formats clock hours past midnight as HH:mm', () => {
    expect(formatMetric('bedtime', '', 24.5)).toBe('00:30')
    expect(formatMetric('bedtime', '', 23.25)).toBe('23:15')
    expect(formatMetric('sleep_midpoint', '', -1)).toBe('23:00')
    expect(formatMetric('wake_time', '', 6.5)).toBe('06:30')
  })
  it('formats other units', () => {
    expect(formatMetric('sleep_hours', 'giờ', 7.5)).toBe('7,5 giờ')
    expect(formatMetric('habit_rate', '0–1', 0.667)).toBe('67%')
    expect(formatMetric('alcohol', '0/1', 1)).toBe('Có')
    expect(formatMetric('mood', '1–5', 4)).toBe('4')
    expect(formatMetric('water_ml', 'ml', 750)).toBe('750 ml')
    expect(formatMetric('mood', '1–5', null)).toBe('–')
  })
})
