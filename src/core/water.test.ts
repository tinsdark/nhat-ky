import { describe, expect, it } from 'vitest'
import type { Entry } from './types'
import {
  DEFAULT_WATER_SIZES,
  formatMl,
  formatWaterSizes,
  lastWaterMl,
  parseWaterSizes,
} from './water'

const water = (start: string, value: number | null, over: Partial<Entry> = {}): Entry =>
  ({ id: start, type: 'water', start, value, deleted: false, ...over }) as Entry

describe('parseWaterSizes', () => {
  it('reads numbers separated by commas or spaces, sorted and without duplicates', () => {
    expect(parseWaterSizes('500, 150 250,250')).toEqual([150, 250, 500])
    expect(parseWaterSizes('330;750')).toEqual([330, 750])
  })
  it('rejects fewer than two sizes, more than eight, or sizes outside 10–3000 ml', () => {
    expect(parseWaterSizes('250')).toBeNull()
    expect(parseWaterSizes('')).toBeNull()
    expect(parseWaterSizes('5, 250')).toBeNull()
    expect(parseWaterSizes('250, 5000')).toBeNull()
    expect(parseWaterSizes('1 2 3 4 5 6 7 8 9')).toBeNull()
    expect(parseWaterSizes('abc, 250')).toBeNull()
  })
  it('round-trips through formatWaterSizes', () => {
    expect(formatWaterSizes(DEFAULT_WATER_SIZES)).toBe('150, 250, 330, 500, 750')
    expect(parseWaterSizes(formatWaterSizes(DEFAULT_WATER_SIZES))).toEqual(DEFAULT_WATER_SIZES)
  })
})

describe('lastWaterMl', () => {
  it('is the amount of the newest live water entry, ignoring other types, deleted and empty ones', () => {
    const es = [
      water('2026-11-02T08:00:00+07:00', 250),
      water('2026-11-02T10:00:00+07:00', 500),
      water('2026-11-02T12:00:00+07:00', 330, { deleted: true }),
      water('2026-11-02T13:00:00+07:00', null),
      { ...water('2026-11-02T14:00:00+07:00', 999), type: 'meal' } as Entry,
    ]
    expect(lastWaterMl(es)).toBe(500)
    expect(lastWaterMl([])).toBeNull()
  })
})

describe('formatMl', () => {
  it('shows ml below a litre and litres with a comma above', () => {
    expect(formatMl(750)).toBe('750 ml')
    expect(formatMl(1000)).toBe('1 L')
    expect(formatMl(1750)).toBe('1,75 L')
    expect(formatMl(2000)).toBe('2 L')
  })
})
