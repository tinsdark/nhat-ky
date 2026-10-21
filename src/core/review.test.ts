import { describe, expect, it } from 'vitest'
import { reviewPrompt } from './review'
import type { Day } from './types'

const at = (iso: string) => new Date(iso).getTime()
const day = (dayScore: number | null) => ({ dayScore, deleted: false }) as Day
const base = {
  dayStartHour: 4,
  reviewTime: '21:30',
  today: undefined,
  yesterday: undefined,
  yesterdayHasEntries: false,
  yesterdayAsked: false,
}

describe('reviewPrompt', () => {
  it('shows tonight from reviewTime on', () => {
    expect(reviewPrompt({ ...base, now: at('2026-11-02T21:29:00+07:00') })).toBeNull()
    expect(reviewPrompt({ ...base, now: at('2026-11-02T21:30:00+07:00') })).toEqual({
      dateKey: '2026-11-02',
      kind: 'tonight',
    })
  })
  it('still counts as tonight after midnight, before the day rolls over', () => {
    expect(reviewPrompt({ ...base, now: at('2026-11-03T01:00:00+07:00') })).toEqual({
      dateKey: '2026-11-02',
      kind: 'tonight',
    })
  })
  it('does not show once the day has a score', () => {
    expect(
      reviewPrompt({ ...base, today: day(7), now: at('2026-11-02T22:00:00+07:00') }),
    ).toBeNull()
    expect(
      reviewPrompt({ ...base, today: day(null), now: at('2026-11-02T22:00:00+07:00') })?.kind,
    ).toBe('tonight')
  })
  it('asks about yesterday once, only if it had entries', () => {
    const now = at('2026-11-03T09:00:00+07:00')
    expect(reviewPrompt({ ...base, now, yesterdayHasEntries: true })).toEqual({
      dateKey: '2026-11-02',
      kind: 'yesterday',
    })
    expect(reviewPrompt({ ...base, now })).toBeNull()
    expect(
      reviewPrompt({ ...base, now, yesterdayHasEntries: true, yesterdayAsked: true }),
    ).toBeNull()
    expect(reviewPrompt({ ...base, now, yesterdayHasEntries: true, yesterday: day(6) })).toBeNull()
  })
})
