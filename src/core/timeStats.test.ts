import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import { defaultDefs } from './defaults'
import { createMetricContext } from './metrics'
import { DEFAULT_SETTINGS } from './settings'
import {
  avgByGroup,
  budgetProgress,
  byProject,
  deepHeatmap,
  groupOfEntry,
  hoursByGroup,
  weekStack,
} from './timeStats'
import type { Entry } from './types'

const cats = defaultDefs('2026-11-01').categories
let n = 0
const e = (
  d: string,
  type: Entry['type'],
  start: string,
  end: string,
  categoryId: string,
  payload: object = {},
): Entry =>
  ({
    id: `e${n++}`,
    type,
    dateKey: d,
    start: atTime(d, start),
    end: atTime(d, end),
    categoryId,
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

// Mon 2026-11-02 … Sun 11-08
const entries: Entry[] = [
  e('2026-11-02', 'work', '09:00', '11:30', 'cat-deep', { focus: 4, project: 'QLBX' }), // 2.5h
  e('2026-11-02', 'work', '13:00', '14:00', 'cat-meeting', { project: 'QLBX' }), // 1h
  e('2026-11-02', 'activity', '20:00', '21:30', 'cat-ba'), // 1.5h growth
  e('2026-11-02', 'activity', '21:30', '22:00', 'cat-social'), // 0.5h personal
  e('2026-11-03', 'work', '09:30', '10:30', 'cat-deep', { focus: 2 }), // 1h
  e('2026-11-03', 'work', '10:30', '11:00', 'cat-chat'), // 0.5h, no project
  e('2026-11-03', 'meal', '12:00', '12:30', ''), // not a time block
  e('2026-11-09', 'work', '09:00', '10:00', 'cat-deep', { focus: 5, project: 'Nhật ký' }), // next Monday
]
const ctx = createMetricContext({ entries, days: [], habits: [], settings: DEFAULT_SETTINGS })

describe('groupOfEntry / hoursByGroup', () => {
  it('uses the category group, falls back to the type, and ignores non-blocks', () => {
    expect(groupOfEntry(entries[0]!, cats)).toBe('work')
    expect(groupOfEntry(entries[2]!, cats)).toBe('growth')
    expect(groupOfEntry(entries[3]!, cats)).toBe('personal')
    expect(groupOfEntry(entries[6]!, cats)).toBeNull()
    expect(groupOfEntry(e('2026-11-02', 'work', '09:00', '10:00', 'custom'), cats)).toBe('work')
    expect(groupOfEntry(e('2026-11-02', 'activity', '09:00', '10:00', 'custom'), cats)).toBe(
      'personal',
    )
  })
  it('sums hours per group for a day (Monday: 3.5 / 1.5 / 0.5)', () => {
    expect(hoursByGroup(ctx, cats, '2026-11-02')).toEqual({ work: 3.5, growth: 1.5, personal: 0.5 })
  })
})

describe('avgByGroup / weekStack', () => {
  it('averages over logged days only', () => {
    // Mon 3.5/1.5/0.5, Tue 1.5/0/0 → 2.5 / 0.75 / 0.25 (11-09 is after "today")
    const a = avgByGroup(ctx, cats, '2026-11-08')!
    expect(a.work).toBeCloseTo(2.5)
    expect(a.growth).toBeCloseTo(0.75)
    expect(a.personal).toBeCloseTo(0.25)
    expect(
      avgByGroup(
        createMetricContext({ entries: [], days: [], habits: [], settings: DEFAULT_SETTINGS }),
        cats,
        '2026-11-08',
      ),
    ).toBeNull()
  })
  it('week stack lists 7 days and totals deep work', () => {
    const w = weekStack(ctx, cats, '2026-11-08')
    expect(w.days).toHaveLength(7)
    expect(w.days[0]!.dateKey).toBe('2026-11-02')
    expect(w.days[0]!.hours.work).toBe(3.5)
    expect(w.deepHours).toBeCloseTo(3.5) // 2.5 + 1
  })
})

describe('deepHeatmap', () => {
  const h = deepHeatmap(ctx, '2026-11-09', 30)
  it('splits blocks over clock hours by weekday', () => {
    // Monday 09:00–11:30 → 60, 60, 30 min at hours 9, 10, 11; plus next Monday 09:00–10:00 → +60 at 9
    expect(h.minutes[0]!.slice(9, 12)).toEqual([120, 60, 30])
    // Tuesday 09:30–10:30 → 30 at 9, 30 at 10
    expect(h.minutes[1]!.slice(9, 12)).toEqual([30, 30, 0])
    expect(h.minutes[0]![13]).toBe(0) // the meeting is not deep work
  })
  it('weights focus by minutes', () => {
    // Monday hour 9: focus 4 for 60 min and focus 5 for 60 min → 4.5; hour 11: only the 4
    expect(h.focus[0]![9]).toBeCloseTo(4.5)
    expect(h.focus[0]![11]).toBe(4)
    expect(h.focus[2]![9]).toBeNull()
  })
})

describe('byProject / budgetProgress', () => {
  it('totals work hours per project for the month, unnamed last', () => {
    expect(byProject(ctx, '2026-11')).toEqual([
      { project: 'QLBX', hours: 3.5 },
      { project: '(chưa gán dự án)', hours: 1.5 },
      { project: 'Nhật ký', hours: 1 },
    ])
  })
  it('compares this week with the Settings budgets', () => {
    const p = budgetProgress(ctx, '2026-11-08')
    expect(p.map((x) => [x.id, x.hours, x.budget, x.kind])).toEqual([
      ['deep', 3.5, 15, 'min'],
      ['ba', 1.5, 4, 'min'],
      ['social', 0.5, 7, 'max'],
    ])
  })
})
