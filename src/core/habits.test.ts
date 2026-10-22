import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import {
  completionRate,
  dayStatus,
  describeSchedule,
  describeTarget,
  habitProgress,
  heatmap,
  isMet,
  streaks,
  valuesByDate,
} from './habits'
import type { Entry, Habit } from './types'

// 2026-11-02 is a Monday.
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h',
  name: 'h',
  direction: 'build',
  kind: 'check',
  target: { op: '>=', value: 1 },
  schedule: { kind: 'daily' },
  reminderTime: null,
  linkedRule: null,
  startDate: '2026-11-02',
  archived: false,
  ...over,
})

const vals = (...keys: string[]) => new Map(keys.map((k) => [k, 1]))

function entry(over: Partial<Entry>): Entry {
  return {
    id: Math.random().toString(),
    type: 'habit',
    dateKey: '2026-11-02',
    start: atTime('2026-11-02', '09:00'),
    end: null,
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
  }
}

describe('isMet', () => {
  it('compares by operator', () => {
    expect(isMet(habit({ target: { op: '>=', value: 20 } }), 20)).toBe(true)
    expect(isMet(habit({ target: { op: '>=', value: 20 } }), 19)).toBe(false)
    expect(isMet(habit({ target: { op: '<=', value: 1 } }), 1)).toBe(true)
    expect(isMet(habit({ target: { op: '=', value: 0 } }), 1)).toBe(false)
  })
})

describe('valuesByDate', () => {
  it('sums ticks of this habit only, a tick without value counts 1', () => {
    const h = habit()
    const m = valuesByDate(h, [
      entry({ payload: { habitId: 'h' } }),
      entry({ payload: { habitId: 'h' }, value: 2 }),
      entry({ payload: { habitId: 'other' } }),
      entry({ payload: { habitId: 'h' }, deleted: true }),
    ])
    expect(m.get('2026-11-02')).toBe(3)
  })
  it('sums water ml for a linked rule', () => {
    const h = habit({ kind: 'count', linkedRule: { entryType: 'water' } })
    const m = valuesByDate(h, [
      entry({ type: 'water', value: 250 }),
      entry({ type: 'water', value: 500 }),
      entry({ type: 'meal', value: 999 }),
    ])
    expect(m.get('2026-11-02')).toBe(750)
  })
  it('uses minutes for linked blocks without a value', () => {
    const h = habit({ kind: 'duration', linkedRule: { entryType: 'exercise' } })
    const m = valuesByDate(h, [
      entry({
        type: 'exercise',
        start: atTime('2026-11-02', '18:00'),
        end: atTime('2026-11-02', '18:40'),
      }),
      entry({ type: 'exercise', start: atTime('2026-11-02', '19:00') }),
    ])
    expect(m.get('2026-11-02')).toBe(40)
  })
})

describe('streaks — Monday to Friday schedule', () => {
  const h = habit({ schedule: { kind: 'weekdays', days: [0, 1, 2, 3, 4] } })
  it('weekend days do not break the streak', () => {
    // met Mon–Fri, Sat/Sun off, Mon met; today = Monday 2026-11-09
    const v = vals(
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-09',
    )
    expect(streaks(h, v, '2026-11-09')).toEqual({ current: 6, longest: 6 })
  })
  it('a missed scheduled day breaks it', () => {
    // Wed 11-04 missing
    const v = vals('2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06')
    expect(streaks(h, v, '2026-11-06')).toEqual({ current: 2, longest: 2 })
  })
  it('today not done yet does not break the current streak', () => {
    const v = vals('2026-11-02', '2026-11-03')
    expect(streaks(h, v, '2026-11-04')).toEqual({ current: 2, longest: 2 })
  })
  it('dayStatus is off on a weekend', () => {
    expect(dayStatus(h, '2026-11-07', new Map())).toBe('off')
  })
})

describe('streaks — 3 times a week', () => {
  const h = habit({ schedule: { kind: 'timesPerWeek', times: 3 } })
  it('counts weeks, not days', () => {
    // week of 11-02: 3 days; week of 11-09: 3 days; week of 11-16 (today, Tue): 1 day so far
    const v = vals(
      '2026-11-02',
      '2026-11-04',
      '2026-11-06',
      '2026-11-09',
      '2026-11-10',
      '2026-11-13',
      '2026-11-17',
    )
    expect(streaks(h, v, '2026-11-17')).toEqual({ current: 2, longest: 2 })
  })
  it('a short finished week breaks it; the open week counts once it reaches the target', () => {
    const v = vals(
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-09',
      '2026-11-10',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    )
    expect(streaks(h, v, '2026-11-18')).toEqual({ current: 1, longest: 1 })
  })
})

describe('streaks — quit habit', () => {
  const h = habit({ direction: 'quit', kind: 'count', target: { op: '=', value: 0 } })
  it('a day with no record is a clean day; a slip breaks the streak', () => {
    const slip = new Map([['2026-11-04', 1]])
    expect(streaks(h, slip, '2026-11-06')).toEqual({ current: 2, longest: 2 })
    expect(dayStatus(h, '2026-11-04', slip)).toBe('missed')
    expect(dayStatus(h, '2026-11-03', slip)).toBe('met')
  })
})

describe('quit habit with loggedDays', () => {
  const h = habit({ direction: 'quit', kind: 'count', target: { op: '=', value: 0 } })
  it('days nothing was logged neither extend nor break the streak', () => {
    const logged = new Set(['2026-11-02', '2026-11-04'])
    const opts = { loggedDays: logged }
    expect(dayStatus(h, '2026-11-03', new Map(), opts)).toBe('rest')
    expect(dayStatus(h, '2026-11-04', new Map(), opts)).toBe('met')
    expect(streaks(h, new Map(), '2026-11-05', opts)).toEqual({ current: 2, longest: 2 })
  })
  it('a slip on a day with a record still counts even if the day has no other entry', () => {
    const slip = new Map([['2026-11-03', 1]])
    expect(dayStatus(h, '2026-11-03', slip, { loggedDays: new Set() })).toBe('missed')
  })
})

describe('rest days', () => {
  const h = habit()
  const dayTypes = new Map([['2026-11-03', 'sick' as const]])
  it('skip keeps the streak alive when enabled', () => {
    const v = vals('2026-11-02', '2026-11-04')
    expect(streaks(h, v, '2026-11-04').current).toBe(1)
    expect(streaks(h, v, '2026-11-04', { skipRestDays: true, dayTypes }).current).toBe(2)
  })
})

describe('completionRate', () => {
  const h = habit()
  it('is met days over due days, today only if met', () => {
    const v = vals('2026-11-02', '2026-11-03')
    // window covers 11-02..11-05: met 2, due 3 (11-04 missed, 11-05 is today unmet → excluded)
    expect(completionRate(h, v, '2026-11-05', 7)).toBeCloseTo(2 / 3)
  })
  it('is null when nothing is due', () => {
    expect(completionRate(h, new Map(), '2026-11-02', 7)).toBeNull()
  })
  it('measures a x-per-week habit against x per 7 days', () => {
    const w = habit({ schedule: { kind: 'timesPerWeek', times: 3 } })
    expect(completionRate(w, vals('2026-11-02', '2026-11-03', '2026-11-04'), '2026-11-08', 7)).toBe(
      1,
    )
    expect(completionRate(w, vals('2026-11-02'), '2026-11-08', 7)).toBeCloseTo(1 / 3)
  })
})

describe('heatmap', () => {
  it('is 12 weeks x 7 days, Monday first, future days marked', () => {
    const cells = heatmap(habit({ startDate: '2026-01-01' }), vals('2026-11-04'), '2026-11-04')
    expect(cells).toHaveLength(12)
    expect(cells.every((w) => w.length === 7)).toBe(true)
    const last = cells[11]!
    expect(last[0]!.dateKey).toBe('2026-11-02')
    expect(last[2]).toEqual({ dateKey: '2026-11-04', status: 'met' })
    expect(last[3]!.status).toBe('future')
  })
})

describe('habit labels', () => {
  it('describeSchedule', () => {
    expect(describeSchedule({ kind: 'daily' })).toBe('Hằng ngày')
    expect(describeSchedule({ kind: 'weekdays', days: [0, 1, 2, 3, 4] })).toBe('T2–T6')
    expect(describeSchedule({ kind: 'weekdays', days: [4, 0, 2] })).toBe('T2, T4, T6')
    expect(describeSchedule({ kind: 'weekdays', days: [5, 6] })).toBe('T7, CN')
    expect(describeSchedule({ kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Hằng ngày')
    expect(describeSchedule({ kind: 'timesPerWeek', times: 3 })).toBe('3 lần/tuần')
  })
  it('describeTarget and habitUnit', () => {
    expect(describeTarget(habit({ kind: 'duration', target: { op: '>=', value: 20 } }))).toBe(
      '≥ 20 phút',
    )
    expect(
      describeTarget(habit({ kind: 'count', target: { op: '=', value: 0 }, direction: 'quit' })),
    ).toBe('= 0 lần')
    expect(
      describeTarget(
        habit({
          kind: 'count',
          target: { op: '>=', value: 2000 },
          linkedRule: { entryType: 'water' },
        }),
      ),
    ).toBe('≥ 2000 ml')
    expect(describeTarget(habit({}))).toBe('')
    expect(
      describeTarget(habit({ metricRule: { metricId: 'bedtime', op: '<=', value: 23.5 } })),
    ).toBe('')
  })
  it('habitProgress: ratio toward a minimum, 0/1 for other targets', () => {
    const read = habit({ kind: 'duration', target: { op: '>=', value: 20 } })
    expect(habitProgress(read, 0)).toBe(0)
    expect(habitProgress(read, 10)).toBe(0.5)
    expect(habitProgress(read, 45)).toBe(1)
    const quit = habit({ kind: 'count', direction: 'quit', target: { op: '=', value: 0 } })
    expect(habitProgress(quit, 0)).toBe(1)
    expect(habitProgress(quit, 2)).toBe(0)
  })
})
