import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import { energyCurve, energyHighlights, healthWeek, sleepBars } from './healthStats'
import { createMetricContext } from './metrics'
import { DEFAULT_SETTINGS } from './settings'
import type { Day, Entry } from './types'

let n = 0
const e = (
  d: string,
  type: Entry['type'],
  start: string,
  end: string | null,
  payload: object = {},
  endDay = d,
): Entry =>
  ({
    id: `e${n++}`,
    type,
    dateKey: d,
    start: atTime(d, start),
    end: end ? atTime(endDay, end) : null,
    categoryId: '',
    title: '',
    value: null,
    unit: '',
    rating: null,
    tags: [],
    photoIds: [],
    payload,
    source: 'manual',
    note: '',
    createdAt: '',
    updatedAt: '',
    deviceId: 'd',
    deleted: false,
    dirty: 0,
  }) as Entry
const next = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}
const night = (d: string, bed: string, wake: string, quality?: number) =>
  e(d, 'sleep', bed, wake, quality ? { quality } : {}, next(d))
const checkin = (d: string, t: string, energy: number) =>
  e(d, 'note', t, null, { checkin: { energy } })

describe('sleepBars', () => {
  it('maps a night to hours after 18:00, crossing midnight', () => {
    const ctx = createMetricContext({
      entries: [night('2026-11-02', '23:30', '07:00', 4), night('2026-11-03', '00:30', '08:30')],
      days: [],
      habits: [],
      settings: DEFAULT_SETTINGS,
    })
    const bars = sleepBars(ctx, '2026-11-02', '2026-11-04')
    expect(bars).toEqual([
      { dateKey: '2026-11-02', startH: 5.5, endH: 13, quality: 4 },
      { dateKey: '2026-11-03', startH: 6.5, endH: 14.5, quality: null },
    ])
  })
})

describe('healthWeek', () => {
  // today Sunday 2026-11-08: this week 11-02..11-08, previous 10-26..11-01
  const entries = [
    night('2026-11-02', '23:00', '06:00'), // 7h
    night('2026-11-03', '23:00', '07:00'), // 8h
    night('2026-10-27', '23:00', '05:00'), // 6h
    e('2026-11-02', 'exercise', '18:00', '18:40'),
    e('2026-11-04', 'exercise', '18:00', '19:20'),
    e('2026-10-28', 'exercise', '18:00', '18:30'),
  ]
  const days = [
    { dateKey: '2026-11-02', mood: 4, deleted: false },
    { dateKey: '2026-10-27', mood: 3, deleted: false },
  ] as Day[]
  const cards = healthWeek(
    createMetricContext({ entries, days, habits: [], settings: DEFAULT_SETTINGS }),
    '2026-11-08',
  )
  const card = (id: string) => cards.find((c) => c.id === id)!
  it('averages sleep and compares with the previous week', () => {
    expect(card('sleep_hours').current).toBeCloseTo(7.5)
    expect(card('sleep_hours').previous).toBeCloseTo(6)
    expect(card('sleep_hours').changePct).toBeCloseTo(25)
  })
  it('adds up exercise minutes instead of averaging', () => {
    expect(card('exercise_min').current).toBe(120) // 40 + 80
    expect(card('exercise_min').previous).toBe(30)
    expect(card('exercise_min').changePct).toBeCloseTo(300)
    expect(card('exercise_min').mode).toBe('sum')
  })
  it('mood mean and null when a side is empty', () => {
    expect(card('mood').current).toBe(4)
    expect(card('mood').previous).toBe(3)
    expect(card('energy').current).toBeNull()
  })
})

describe('energy curve', () => {
  const entries = [
    ...['09', '10', '11'].flatMap((h) =>
      ['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => checkin(d, `${h}:30`, 4)),
    ),
    ...['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => checkin(d, '15:10', 2)),
    ...['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => checkin(d, '20:00', 3)),
    checkin('2026-11-02', '22:00', 1), // a single sample: ignored by the highlights
  ]
  const ctx = createMetricContext({ entries, days: [], habits: [], settings: DEFAULT_SETTINGS })
  const curve = energyCurve(ctx, '2026-11-08')
  it('averages check-ins by clock hour', () => {
    expect(curve[9]).toEqual({ hour: 9, mean: 4, n: 3 })
    expect(curve[15]).toEqual({ hour: 15, mean: 2, n: 3 })
    expect(curve[3]).toEqual({ hour: 3, mean: null, n: 0 })
  })
  it('finds the peak and the dip among hours with enough samples', () => {
    expect(energyHighlights(curve)).toEqual({ peak: 9, dip: 15, spread: 2 })
  })
  it('says nothing with too few hours or a flat day', () => {
    expect(energyHighlights(curve.filter((p) => p.hour < 11))).toBeNull()
    expect(
      energyHighlights([
        { hour: 9, mean: 3, n: 5 },
        { hour: 12, mean: 3.2, n: 5 },
        { hour: 15, mean: 3.1, n: 5 },
      ]),
    ).toBeNull()
  })
})
