import { describe, expect, it } from 'vitest'
import { atTime, toDateKey, toHHmm } from './date'
import { buildTimeline, coreProgress } from './timeline'
import type { Day, Entry } from './types'

function entry(over: Partial<Entry> & Pick<Entry, 'start'>): Entry {
  return {
    id: over.start,
    type: 'activity',
    dateKey: '2026-11-02',
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

const at = (hhmm: string) => atTime('2026-11-02', hhmm)

describe('atTime / toHHmm', () => {
  it('puts hours before dayStartHour on the next calendar day', () => {
    expect(at('23:00')).toBe('2026-11-02T23:00:00.000+07:00')
    expect(at('01:30')).toBe('2026-11-03T01:30:00.000+07:00')
    expect(toDateKey(at('01:30'))).toBe('2026-11-02')
  })
  it('round-trips with toHHmm', () => {
    expect(toHHmm(at('08:05'))).toBe('08:05')
    expect(toHHmm(at('01:30'))).toBe('01:30')
  })
})

describe('buildTimeline', () => {
  it('keeps an entry crossing midnight (23:00–01:00) in order with 120 minutes', () => {
    const rows = buildTimeline([
      entry({ start: at('23:00'), end: at('01:00') }),
      entry({ start: at('08:00'), end: at('09:00') }),
    ])
    const entries = rows.filter((r) => r.kind === 'entry')
    expect(entries.map((r) => r.kind === 'entry' && r.minutes)).toEqual([60, 120])
    expect(toHHmm((entries[1] as { entry: Entry }).entry.start)).toBe('23:00')
  })

  it('inserts a gap only when more than 2 hours are empty', () => {
    const rows = buildTimeline([
      entry({ start: at('08:00'), end: at('09:00') }),
      entry({ start: at('11:00'), end: at('12:00') }), // exactly 2h → no gap
      entry({ start: at('14:01') }), // 2h01 → gap
    ])
    expect(rows.map((r) => r.kind)).toEqual(['entry', 'entry', 'gap', 'entry'])
  })

  it('measures gaps from the latest end when entries overlap', () => {
    const rows = buildTimeline([
      entry({ start: at('08:00'), end: at('15:00') }),
      entry({ start: at('09:00'), end: at('10:00') }),
      entry({ start: at('16:00') }),
    ])
    expect(rows.map((r) => r.kind)).toEqual(['entry', 'entry', 'entry'])
  })

  it('adds a trailing gap up to now only when now is given', () => {
    const list = [entry({ start: at('08:00') })]
    expect(buildTimeline(list)).toHaveLength(1)
    const now = new Date(at('12:00')).getTime()
    const rows = buildTimeline(list, { now })
    expect(rows.map((r) => r.kind)).toEqual(['entry', 'gap'])
  })

  it('returns nothing for an empty day', () => {
    expect(buildTimeline([], { now: Date.now() })).toEqual([])
  })
})

describe('coreProgress meals by slot', () => {
  const meal = (over: Partial<Entry>) =>
    entry({ start: atTime('2026-11-02', '12:00'), type: 'meal', ...over })
  it('counts a meal by payload.mealSlot when it has no category, but never a drink', () => {
    const done = (es: Entry[]) =>
      coreProgress(es, undefined)
        .filter((i) => i.done)
        .map((i) => i.id)
    expect(done([meal({ payload: { mealSlot: 'lunch' } })])).toEqual(['lunch'])
    expect(done([meal({ payload: { mealSlot: 'lunch', drink: 'coffee' } })])).toEqual([])
    expect(done([meal({ categoryId: 'cat-drink', payload: { mealSlot: 'lunch' } })])).toEqual([])
  })
})

describe('coreProgress', () => {
  it('marks items by entry type and meal category', () => {
    const items = coreProgress(
      [
        entry({ start: at('07:00'), type: 'sleep' }),
        entry({ start: at('12:00'), type: 'meal', categoryId: 'cat-lunch' }),
        entry({ start: at('15:00'), type: 'meal', categoryId: 'cat-drink' }),
      ],
      undefined,
    )
    const done = items.filter((i) => i.done).map((i) => i.id)
    expect(done).toEqual(['sleep', 'lunch'])
    expect(items).toHaveLength(6)
  })
  it('counts the rating once the day has a score', () => {
    const day = { dayScore: 7 } as Day
    expect(coreProgress([], day).find((i) => i.id === 'rating')?.done).toBe(true)
    expect(coreProgress([], { dayScore: null } as Day).find((i) => i.id === 'rating')?.done).toBe(
      false,
    )
  })
})
