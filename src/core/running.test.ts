import { describe, expect, it } from 'vitest'
import type { Entry } from './types'
import { finishPatch, isRunning, isTimedType, runningEntries, startRunning } from './running'

const entry = (over: Partial<Entry> = {}): Entry =>
  ({
    id: 'e1',
    type: 'work',
    start: '2026-10-21T09:00:00+07:00',
    end: null,
    deleted: false,
    payload: { running: true, isOvertime: false },
    ...over,
  }) as Entry

describe('isTimedType', () => {
  it('lasting types are timed, instant ones are not', () => {
    for (const t of ['meal', 'work', 'activity', 'exercise', 'study', 'x-abc'] as const)
      expect(isTimedType(t)).toBe(true)
    for (const t of ['water', 'sleep', 'note', 'habit'] as const) expect(isTimedType(t)).toBe(false)
  })
})

describe('isRunning / runningEntries', () => {
  it('needs the flag, no end and not deleted', () => {
    expect(isRunning(entry())).toBe(true)
    expect(isRunning(entry({ end: '2026-10-21T10:00:00+07:00' }))).toBe(false)
    expect(isRunning(entry({ deleted: true }))).toBe(false)
    expect(isRunning(entry({ payload: {} }))).toBe(false)
  })
  it('lists oldest first', () => {
    const a = entry({ id: 'a', start: '2026-10-21T11:00:00+07:00' })
    const b = entry({ id: 'b', start: '2026-10-21T08:00:00+07:00' })
    expect(runningEntries([a, entry({ end: 'x', id: 'c' }), b]).map((e) => e.id)).toEqual([
      'b',
      'a',
    ])
  })
})

describe('finishPatch', () => {
  it('sets the end and drops only the running flag', () => {
    const patch = finishPatch(entry(), '2026-10-21T10:30:00+07:00')
    expect(patch).toEqual({ end: '2026-10-21T10:30:00+07:00', payload: { isOvertime: false } })
  })
  it('refuses a block that is not running, ends before it starts, or lasts over 16 hours', () => {
    expect(finishPatch(entry({ payload: {} }), '2026-10-21T10:00:00+07:00')).toBeNull()
    expect(finishPatch(entry(), '2026-10-21T08:59:00+07:00')).toBeNull()
    expect(finishPatch(entry(), '2026-10-22T01:01:00+07:00')).toBeNull()
  })
  it('startRunning sets the flag without touching the rest', () => {
    expect(startRunning({ project: 'A' })).toEqual({ project: 'A', running: true })
  })
})
