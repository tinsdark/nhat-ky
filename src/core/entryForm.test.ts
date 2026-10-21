import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import { autoMealSlot, copyToDay, findOverlaps, shiftHHmm, suggestTitles } from './entryForm'
import type { Entry } from './types'

function e(over: Partial<Entry>): Entry {
  return {
    id: Math.random().toString(),
    type: 'meal',
    dateKey: '2026-11-02',
    start: atTime('2026-11-02', '12:00'),
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

describe('suggestTitles', () => {
  it('sorts by frequency, then recency, filtered by type', () => {
    const h = [
      e({ title: 'Phở bò', start: '2026-10-01T12:00:00.000+07:00' }),
      e({ title: 'Cơm văn phòng', start: '2026-10-02T12:00:00.000+07:00' }),
      e({ title: 'Cơm văn phòng', start: '2026-10-03T12:00:00.000+07:00' }),
      e({ title: 'Bún chả', start: '2026-10-05T12:00:00.000+07:00' }),
      e({ title: 'Code', type: 'work' }),
      e({ title: '  ' }),
      e({ title: 'Đã xoá', deleted: true }),
    ]
    expect(suggestTitles(h, 'meal')).toEqual(['Cơm văn phòng', 'Bún chả', 'Phở bò'])
  })
  it('respects the limit', () => {
    const h = ['a', 'b', 'c'].map((title) => e({ title }))
    expect(suggestTitles(h, 'meal', 2)).toHaveLength(2)
  })
})

describe('shiftHHmm', () => {
  it('shifts and wraps around midnight', () => {
    expect(shiftHHmm('12:00', -15)).toBe('11:45')
    expect(shiftHHmm('12:10', -60)).toBe('11:10')
    expect(shiftHHmm('00:10', -30)).toBe('23:40')
    expect(shiftHHmm('23:50', 20)).toBe('00:10')
  })
})

describe('findOverlaps', () => {
  const a = e({
    id: 'a',
    type: 'work',
    start: atTime('2026-11-02', '09:00'),
    end: atTime('2026-11-02', '11:00'),
  })
  it('finds overlapping blocks of the same type', () => {
    expect(
      findOverlaps([a], 'work', atTime('2026-11-02', '10:00'), atTime('2026-11-02', '12:00')),
    ).toHaveLength(1)
  })
  it('ignores touching ends, other types, the edited entry and open ranges', () => {
    expect(
      findOverlaps([a], 'work', atTime('2026-11-02', '11:00'), atTime('2026-11-02', '12:00')),
    ).toEqual([])
    expect(
      findOverlaps([a], 'activity', atTime('2026-11-02', '10:00'), atTime('2026-11-02', '12:00')),
    ).toEqual([])
    expect(
      findOverlaps([a], 'work', atTime('2026-11-02', '10:00'), atTime('2026-11-02', '12:00'), 'a'),
    ).toEqual([])
    expect(findOverlaps([a], 'work', atTime('2026-11-02', '10:00'), null)).toEqual([])
  })
})

describe('autoMealSlot', () => {
  it('uses the category first', () => {
    expect(autoMealSlot('cat-lunch', '23:00')).toBe('lunch')
  })
  it('falls back to late after 22:00 and before 04:00, else snack', () => {
    expect(autoMealSlot('cat-drink', '22:30')).toBe('late')
    expect(autoMealSlot('', '01:00')).toBe('late')
    expect(autoMealSlot('', '15:00')).toBe('snack')
  })
})

describe('copyToDay', () => {
  it('keeps clock times (including past midnight) on the target day and drops sync fields', () => {
    const src = e({
      id: 'x',
      type: 'work',
      title: 'Code',
      start: atTime('2026-11-02', '23:00'),
      end: atTime('2026-11-02', '01:00'),
      source: 'timer',
      photoIds: ['p1'],
    })
    const copy = copyToDay(src, '2026-11-03', 4)
    expect(copy.start).toBe('2026-11-03T23:00:00.000+07:00')
    expect(copy.end).toBe('2026-11-04T01:00:00.000+07:00')
    expect(copy.source).toBe('manual')
    expect(copy).not.toHaveProperty('id')
    expect(copy).not.toHaveProperty('photoIds')
  })
  it('copies an open entry as open', () => {
    expect(copyToDay(e({ start: atTime('2026-11-02', '08:00') }), '2026-11-03', 4).end).toBeNull()
  })
})
