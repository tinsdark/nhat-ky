import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import {
  addMinutes,
  autoMealSlot,
  copyToDay,
  findOverlaps,
  formatDuration,
  resolveEnd,
  shiftHHmm,
} from './entryForm'
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
  it('otherwise follows the hour', () => {
    expect(autoMealSlot('', '07:30')).toBe('breakfast')
    expect(autoMealSlot('', '12:34')).toBe('lunch')
    expect(autoMealSlot('', '16:00')).toBe('snack')
    expect(autoMealSlot('', '19:00')).toBe('dinner')
    expect(autoMealSlot('cat-drink', '22:30')).toBe('late')
    expect(autoMealSlot('', '01:00')).toBe('late')
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
      source: 'quick',
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

describe('resolveEnd / durations', () => {
  const start = atTime('2026-11-02', '23:30')
  it('rolls an end at or before the start to the next day', () => {
    expect(resolveEnd(start, atTime('2026-11-02', '06:30'))).toBe(
      new Date('2026-11-03T06:30:00+07:00').toISOString(),
    )
    expect(resolveEnd(atTime('2026-11-02', '09:00'), atTime('2026-11-02', '11:00'))).toBe(
      new Date('2026-11-02T11:00:00+07:00').toISOString(),
    )
  })
  it('keeps a crossing-midnight end as is', () => {
    expect(resolveEnd(atTime('2026-11-02', '23:00'), atTime('2026-11-02', '01:00'))).toBe(
      new Date('2026-11-03T01:00:00+07:00').toISOString(),
    )
  })
  it('rejects blocks over 16 hours, including end = start', () => {
    expect(resolveEnd(atTime('2026-11-02', '08:00'), atTime('2026-11-02', '08:00'))).toBeNull()
    expect(resolveEnd(atTime('2026-11-02', '08:00'), atTime('2026-11-02', '01:00'))).toBeNull()
  })
  it('addMinutes and formatDuration', () => {
    expect(addMinutes('2026-11-02T10:00:00.000Z', 90)).toBe('2026-11-02T11:30:00.000Z')
    expect([15, 60, 90, 120, 135].map(formatDuration)).toEqual(['15p', '1h', '1h30', '2h', '2h15'])
  })
})
