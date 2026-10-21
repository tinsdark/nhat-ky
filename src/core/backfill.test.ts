import { describe, expect, it } from 'vitest'
import { backfillDefaults, roundHHmm } from './backfill'

describe('backfillDefaults', () => {
  it('uses the category first, then the type, then the fallback', () => {
    expect(backfillDefaults({ type: 'meal', categoryId: 'cat-lunch' }, '10:00')).toEqual({
      start: '12:00',
      minutes: null,
    })
    expect(backfillDefaults({ type: 'work', categoryId: 'cat-meeting' }, '10:00')).toEqual({
      start: '09:00',
      minutes: 120,
    })
    expect(backfillDefaults({ type: 'meal', categoryId: 'custom' }, '10:05')).toEqual({
      start: '10:05',
      minutes: null,
    })
    expect(backfillDefaults({ type: 'sleep', categoryId: 'cat-sleep' }, '10:00').minutes).toBe(450)
  })
  it('roundHHmm drops to the previous 5 minutes', () => {
    expect(roundHHmm('14:07')).toBe('14:05')
    expect(roundHHmm('14:00')).toBe('14:00')
    expect(roundHHmm('09:59')).toBe('09:55')
  })
})
