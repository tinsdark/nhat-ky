import { describe, expect, it } from 'vitest'
import { isDay, isEntry, keepValid } from './validate'

const NOW = Date.parse('2026-10-22T10:00:00+07:00')
const entry = (over: object = {}) => ({
  id: 'e1',
  type: 'note',
  dateKey: '2026-10-22',
  start: '2026-10-22T08:00:00.000+07:00',
  end: null,
  tags: [],
  payload: {},
  createdAt: '2026-10-22T08:00:00.000+07:00',
  updatedAt: '2026-10-22T08:00:00.000+07:00',
  deviceId: 'A',
  deleted: false,
  ...over,
})
const day = (over: object = {}) => ({
  dateKey: '2026-10-22',
  createdAt: '2026-10-22T08:00:00.000+07:00',
  updatedAt: '2026-10-22T08:00:00.000+07:00',
  deviceId: 'A',
  deleted: false,
  ...over,
})

describe('isEntry', () => {
  it('accepts a normal entry, open or closed', () => {
    expect(isEntry(entry(), NOW)).toBe(true)
    expect(isEntry(entry({ end: '2026-10-22T09:00:00.000+07:00' }), NOW)).toBe(true)
  })
  it('rejects wrong shapes', () => {
    for (const bad of [
      null,
      'x',
      [],
      entry({ id: '' }),
      entry({ dateKey: '22/10/2026' }),
      entry({ start: 'abc' }),
      entry({ end: 'abc' }),
      entry({ tags: 'a' }),
      entry({ payload: null }),
      entry({ deleted: 'yes' }),
      entry({ deviceId: '' }),
    ])
      expect(isEntry(bad, NOW)).toBe(false)
  })
  it('rejects an updatedAt more than a day in the future, accepts a few hours ahead (clock skew)', () => {
    expect(isEntry(entry({ updatedAt: '9999-01-01T00:00:00.000+07:00' }), NOW)).toBe(false)
    expect(isEntry(entry({ updatedAt: '2026-10-22T14:00:00.000+07:00' }), NOW)).toBe(true)
  })
})

describe('isDay / keepValid', () => {
  it('checks dateKey and sync fields', () => {
    expect(isDay(day(), NOW)).toBe(true)
    expect(isDay(day({ dateKey: 'x' }), NOW)).toBe(false)
    expect(isDay(day({ updatedAt: '2999-01-01T00:00:00Z' }), NOW)).toBe(false)
  })
  it('drops bad records and counts them', () => {
    const r = keepValid([entry(), { id: 1 }, null], (v): v is object => isEntry(v, NOW))
    expect(r.valid).toHaveLength(1)
    expect(r.skipped).toBe(2)
  })
})
