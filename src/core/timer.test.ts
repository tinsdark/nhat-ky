import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import { DEFAULT_SETTINGS } from './settings'
import { formatElapsed, isOvertime } from './timer'

// 2026-11-02 is a Monday, 2026-11-07 a Saturday.
const mon = (hhmm: string) => atTime('2026-11-02', hhmm)
const sat = (hhmm: string) => atTime('2026-11-07', hhmm)
const ot = (a: string, b: string) => isOvertime(a, b, DEFAULT_SETTINGS)

describe('formatElapsed', () => {
  it('formats HH:mm:ss and clamps negatives', () => {
    expect(formatElapsed(0)).toBe('00:00:00')
    expect(formatElapsed(3_723_000)).toBe('01:02:03')
    expect(formatElapsed(-5)).toBe('00:00:00')
    expect(formatElapsed(100 * 3_600_000)).toBe('100:00:00')
  })
})

describe('isOvertime', () => {
  it('is false inside working hours on a working day', () => {
    expect(ot(mon('08:00'), mon('17:30'))).toBe(false)
    expect(ot(mon('09:15'), mon('11:00'))).toBe(false)
  })
  it('is true when any part is outside the window', () => {
    expect(ot(mon('07:30'), mon('09:00'))).toBe(true)
    expect(ot(mon('17:00'), mon('18:00'))).toBe(true)
    expect(ot(mon('19:00'), mon('20:00'))).toBe(true)
  })
  it('is true on non-working days', () => {
    expect(ot(sat('09:00'), sat('10:00'))).toBe(true)
  })
  it('is true when crossing midnight', () => {
    expect(ot(mon('23:00'), mon('01:00'))).toBe(true)
  })
  it('respects custom settings', () => {
    const s = { ...DEFAULT_SETTINGS, workDays: [5], workStart: '09:00', workEnd: '12:00' }
    expect(isOvertime(sat('09:00'), sat('11:00'), s)).toBe(false)
    expect(isOvertime(mon('09:00'), mon('11:00'), s)).toBe(true)
  })
})
