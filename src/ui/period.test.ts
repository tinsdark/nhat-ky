import { describe, expect, it } from 'vitest'
import { PERIODS, periodOf } from './period'

describe('periodOf', () => {
  it('splits the day at 5, 10, 14, 18 and 22h', () => {
    expect([4, 5, 9, 10, 13, 14, 17, 18, 21, 22, 23, 0].map(periodOf)).toEqual([
      'dem',
      'sang',
      'sang',
      'trua',
      'trua',
      'chieu',
      'chieu',
      'toi',
      'toi',
      'dem',
      'dem',
      'dem',
    ])
  })
  it('covers every hour with a known period', () => {
    for (let h = 0; h < 24; h++) expect(PERIODS).toContain(periodOf(h))
  })
})
