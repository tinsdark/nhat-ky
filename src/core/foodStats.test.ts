import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import { food30, todayFood, weekMealTable } from './foodStats'
import { createMetricContext } from './metrics'
import { DEFAULT_SETTINGS } from './settings'
import type { Entry } from './types'

let n = 0
const e = (dateKey: string, type: Entry['type'], start: string, over: Partial<Entry> = {}): Entry =>
  ({
    id: `e${n++}`,
    type,
    dateKey,
    start: atTime(dateKey, start),
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
  }) as Entry
const meal = (d: string, t: string, slot: string, over: Partial<Entry> = {}) =>
  e(d, 'meal', t, { payload: { mealSlot: slot, ...(over.payload ?? {}) }, ...over })

// Mon 2026-11-02 … Sun 11-08; today = Sunday
const entries: Entry[] = [
  meal('2026-11-02', '07:30', 'breakfast', {
    title: 'Phở bò',
    payload: { mealSlot: 'breakfast', place: 'out' },
  }),
  meal('2026-11-02', '12:00', 'lunch', {
    title: 'Cơm văn phòng',
    payload: { mealSlot: 'lunch', place: 'office' },
  }),
  meal('2026-11-02', '19:00', 'dinner', {
    title: 'Cơm nhà',
    payload: { mealSlot: 'dinner', place: 'home' },
  }),
  meal('2026-11-03', '12:30', 'lunch', {
    title: 'Cơm văn phòng',
    payload: { mealSlot: 'lunch', place: 'office' },
  }),
  meal('2026-11-03', '22:30', 'late', { title: 'Mì gói', payload: { mealSlot: 'late' } }),
  e('2026-11-04', 'note', '09:00'), // logged, no meals
  meal('2026-11-08', '07:00', 'breakfast', {
    categoryId: 'cat-breakfast',
    payload: { items: ['Bánh mì', 'Trứng'], place: 'delivery' },
  }),
  e('2026-11-08', 'water', '10:00', { value: 500 }),
  e('2026-11-08', 'water', '14:00', { value: 750 }),
  e('2026-11-08', 'meal', '09:00', { categoryId: 'cat-drink', title: 'Cà phê' }),
  e('2026-11-08', 'meal', '15:00', { categoryId: 'cat-drink', title: 'Cà phê' }),
]
const ctx = createMetricContext({ entries, days: [], habits: [], settings: DEFAULT_SETTINGS })
const TODAY = '2026-11-08'

describe('weekMealTable', () => {
  const rows = weekMealTable(ctx, TODAY)
  it('has the 7 days ending today', () => {
    expect(rows.map((r) => r.dateKey)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ])
  })
  it('marks eaten meals with their time, missed ones on logged days, unknown on empty days', () => {
    expect(rows[0]!.meals.breakfast).toEqual({ status: 'ok', time: '07:30' })
    expect(rows[1]!.meals.breakfast.status).toBe('missed') // Tue logged, no breakfast
    expect(rows[2]!.meals.lunch.status).toBe('missed') // Wed logged, nothing eaten
    expect(rows[3]!.meals.lunch.status).toBe('unknown') // Thu empty
  })
  it('flags a late meal, null on empty days', () => {
    expect(rows.map((r) => r.late)).toEqual([false, true, false, null, null, null, false])
  })
})

describe('food30', () => {
  const f = food30(ctx, TODAY)
  it('averages main meal times and counts skipped meals over logged days', () => {
    expect(f.loggedDays).toBe(4)
    expect(f.avgTime.breakfast).toBeCloseTo((7.5 + 7) / 2)
    expect(f.avgTime.lunch).toBeCloseTo((12 + 12.5) / 2)
    expect(f.avgTime.dinner).toBeCloseTo(19)
    expect(f.skipped).toEqual({ breakfast: 2, lunch: 2, dinner: 3 })
  })
  it('eating out share only counts meals with a known place', () => {
    // places: out, office, home, office, delivery → 2 of 5
    expect(f.eatingOutShare).toBeCloseTo(0.4)
  })
  it('most frequent dishes, items before titles, drinks excluded', () => {
    expect(f.topDishes[0]).toEqual({ name: 'Cơm văn phòng', count: 2 })
    expect(f.topDishes.map((d) => d.name)).toContain('Bánh mì')
    expect(f.topDishes.map((d) => d.name)).not.toContain('Cà phê')
  })
  it('average eating window needs two meals in a day', () => {
    // Mon 07:30→19:00 = 11.5; Tue 12:30→22:30 = 10
    expect(f.avgWindow).toBeCloseTo((11.5 + 10) / 2)
  })
})

describe('todayFood', () => {
  it('meal boxes, water against the target, coffee count', () => {
    const t = todayFood(ctx, TODAY)
    expect(t.meals).toEqual([
      { slot: 'breakfast', done: true, time: '07:00' },
      { slot: 'lunch', done: false, time: null },
      { slot: 'dinner', done: false, time: null },
    ])
    expect(t.waterMl).toBe(1250)
    expect(t.waterTargetMl).toBe(2000)
    expect(t.coffee).toBe(2)
  })
})
