import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import { createMetricContext } from './metrics'
import { DEFAULT_SETTINGS } from './settings'
import { weeklyReport } from './weeklyReport'
import type { Day, Entry, Habit } from './types'

let n = 0
const e = (
  d: string,
  type: Entry['type'],
  start: string,
  end: string | null,
  over: Partial<Entry> = {},
): Entry =>
  ({
    id: `e${n++}`,
    type,
    dateKey: d,
    start: atTime(d, start),
    end: end ? atTime(d, end) : null,
    categoryId: '',
    title: '',
    value: null,
    unit: '',
    rating: null,
    tags: [],
    photoIds: [],
    payload: {},
    source: 'manual',
    note: '',
    createdAt: '',
    updatedAt: '',
    deviceId: 'd',
    deleted: false,
    dirty: 0,
    ...over,
  }) as Entry
const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id,
  name: id,
  direction: 'build',
  kind: 'check',
  target: { op: '>=', value: 1 },
  schedule: { kind: 'daily' },
  reminderTime: null,
  linkedRule: null,
  startDate: '2026-10-01',
  archived: false,
  ...over,
})
const tick = (d: string, id: string) => e(d, 'habit', '21:00', null, { payload: { habitId: id } })

// week = Mon 2026-11-02 … Sun 11-08; previous week 10-26 … 11-01
const entries = [
  e('2026-11-02', 'work', '09:00', '12:00', { categoryId: 'cat-deep' }),
  e('2026-11-03', 'work', '09:00', '11:00', { categoryId: 'cat-deep' }),
  e('2026-10-27', 'work', '09:00', '10:00', { categoryId: 'cat-deep' }),
  e('2026-11-02', 'exercise', '18:00', '18:45'),
  ...['2026-11-02', '2026-11-03', '2026-11-05'].map((d) => tick(d, 'read')),
  ...['2026-11-02', '2026-11-04'].map((d) => tick(d, 'gym')),
]
const days = [
  { dateKey: '2026-11-02', dayScore: 8, mood: 4, deleted: false },
  { dateKey: '2026-11-04', dayScore: 6, mood: null, deleted: false },
  { dateKey: '2026-10-28', dayScore: 5, mood: 3, deleted: false },
] as Day[]
const habits = [
  habit('read'),
  habit('gym', { schedule: { kind: 'timesPerWeek', times: 3 } }),
  habit('old', { archived: true }),
]
const r = weeklyReport(
  createMetricContext({ entries, days, habits, settings: DEFAULT_SETTINGS }),
  '2026-11-08',
  habits,
)
const row = (id: string) => r.rows.find((x) => x.id === id)!

describe('weeklyReport', () => {
  it('covers the 7 days ending on the date and counts logged days', () => {
    expect([r.from, r.to]).toEqual(['2026-11-02', '2026-11-08'])
    expect(r.daily).toHaveLength(7)
    expect(r.loggedDays).toBe(4) // entries exist on 11-02, 11-03, 11-04 (gym tick), 11-05 (read tick)
  })
  it('sums hours-type metrics and compares with the previous week', () => {
    expect(row('deep_work_hours')).toMatchObject({ mode: 'sum', current: 5, previous: 1 })
    expect(row('deep_work_hours').changePct).toBeCloseTo(400)
    expect(row('exercise_min').current).toBe(45)
  })
  it('averages scores and leaves null where a side has no data', () => {
    expect(row('day_score')).toMatchObject({ current: 7, previous: 5 })
    expect(row('mood').current).toBe(4)
    expect(row('stress').current).toBeNull()
  })
  it('lists per-day score, and habit completion (timesPerWeek due = its x), skipping archived', () => {
    expect(r.daily[0]).toMatchObject({ dateKey: '2026-11-02', dayScore: 8, mood: 4 })
    expect(r.daily[1]!.dayScore).toBeNull()
    expect(r.habits).toEqual([
      { name: 'read', met: 3, due: 7 },
      { name: 'gym', met: 2, due: 3 },
    ])
  })
})
