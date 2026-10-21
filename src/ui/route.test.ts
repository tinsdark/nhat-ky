import { describe, expect, it } from 'vitest'
import { parseHash, parseHashQuery } from './route'

describe('parseHash', () => {
  it('maps known tabs', () => {
    expect(parseHash('#/today')).toBe('today')
    expect(parseHash('#/habits')).toBe('habits')
    expect(parseHash('#/backfill')).toBe('backfill')
    expect(parseHash('#/stats')).toBe('stats')
    expect(parseHash('#/settings')).toBe('settings')
  })
  it('accepts hash without slash and trailing parts', () => {
    expect(parseHash('#stats')).toBe('stats')
    expect(parseHash('#/habits/new')).toBe('habits')
    expect(parseHash('#/stats?range=30')).toBe('stats')
  })
  it('falls back to today', () => {
    expect(parseHash('')).toBe('today')
    expect(parseHash('#')).toBe('today')
    expect(parseHash('#/nope')).toBe('today')
  })
})

describe('parseHashQuery', () => {
  it('reads the query after the route', () => {
    expect(parseHashQuery('#/backfill?d=2026-11-02&s=09:00')).toEqual({
      d: '2026-11-02',
      s: '09:00',
    })
    expect(parseHashQuery('#/today')).toEqual({})
  })
})
