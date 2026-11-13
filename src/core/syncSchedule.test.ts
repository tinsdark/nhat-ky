import { describe, expect, it } from 'vitest'
import { IDLE_POLL_MS, pollDue } from './syncSchedule'

describe('pollDue', () => {
  it('syncs every tick while something waits to be pushed', () => {
    expect(pollDue({ pending: true, sinceLastRunMs: 1_000 })).toBe(true)
  })
  it('without local changes, only every few minutes', () => {
    expect(pollDue({ pending: false, sinceLastRunMs: 60_000 })).toBe(false)
    expect(pollDue({ pending: false, sinceLastRunMs: IDLE_POLL_MS })).toBe(true)
  })
})
