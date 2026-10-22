import { describe, expect, it } from 'vitest'
import { addDays, addMonths, dateKeyRange, toDateKey, toIso, weekday } from './date'

describe('toDateKey', () => {
  it('00:40 Tue belongs to Monday night', () => {
    expect(toDateKey('2026-10-20T00:40:00+07:00')).toBe('2026-10-19')
  })
  it('04:00 is the start of the new day', () => {
    expect(toDateKey('2026-10-20T04:00:00+07:00')).toBe('2026-10-20')
  })
  it('03:59 still belongs to the previous day', () => {
    expect(toDateKey('2026-10-20T03:59:00+07:00')).toBe('2026-10-19')
  })
  it('evening and morning of the same day', () => {
    expect(toDateKey('2026-10-19T23:15:00+07:00')).toBe('2026-10-19')
    expect(toDateKey('2026-10-20T07:10:00+07:00')).toBe('2026-10-20')
  })
  it('respects dayStartHour = 5', () => {
    expect(toDateKey('2026-10-20T04:30:00+07:00', 5)).toBe('2026-10-19')
    expect(toDateKey('2026-10-20T05:00:00+07:00', 5)).toBe('2026-10-20')
  })
  it('converts other offsets to UTC+7', () => {
    // 2026-10-19T17:40Z = 2026-10-20T00:40+07:00
    expect(toDateKey('2026-10-19T17:40:00Z')).toBe('2026-10-19')
    expect(toDateKey('2026-10-19T21:00:00+00:00')).toBe('2026-10-20')
  })
  it('accepts Date and epoch ms', () => {
    const d = new Date('2026-10-20T00:40:00+07:00')
    expect(toDateKey(d)).toBe('2026-10-19')
    expect(toDateKey(d.getTime())).toBe('2026-10-19')
  })
  it('crosses month and year boundaries', () => {
    expect(toDateKey('2027-01-01T01:00:00+07:00')).toBe('2026-12-31')
    expect(toDateKey('2026-11-01T02:00:00+07:00')).toBe('2026-10-31')
  })
  it('throws on invalid input', () => {
    expect(() => toDateKey('not a date')).toThrow()
  })
})

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2026-10-19', 1)).toBe('2026-10-20')
    expect(addDays('2026-10-19', -19)).toBe('2026-09-30')
    expect(addDays('2026-10-19', 0)).toBe('2026-10-19')
  })
  it('handles leap years and year ends', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('dateKeyRange', () => {
  it('is inclusive on both ends', () => {
    expect(dateKeyRange('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })
  it('single day', () => {
    expect(dateKeyRange('2026-10-19', '2026-10-19')).toEqual(['2026-10-19'])
  })
  it('empty when from > to', () => {
    expect(dateKeyRange('2026-10-20', '2026-10-19')).toEqual([])
  })
})

describe('weekday (Mon = 0 … Sun = 6)', () => {
  it('known dates', () => {
    expect(weekday('2026-10-19')).toBe(0) // Monday
    expect(weekday('2026-10-20')).toBe(1)
    expect(weekday('2026-10-25')).toBe(6) // Sunday
    expect(weekday('2028-02-29')).toBe(1) // Tuesday
  })
})

describe('toIso', () => {
  it('writes the +07:00 offset and round-trips', () => {
    const iso = toIso(new Date('2026-10-19T17:40:00Z'))
    expect(iso).toBe('2026-10-20T00:40:00.000+07:00')
    expect(new Date(iso).getTime()).toBe(Date.parse('2026-10-19T17:40:00Z'))
  })
})

describe('addMonths', () => {
  it('moves across year ends', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-10', 0)).toBe('2026-10')
  })
})
