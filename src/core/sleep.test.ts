import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import { averageBedtime, bedtimeBefore, findOpenNightSleep, shouldAskLastNight } from './sleep'
import type { Entry } from './types'

const sleep = (start: string, end: string | null, payload = {}): Entry =>
  ({ type: 'sleep', start, end, payload, deleted: false }) as unknown as Entry

describe('averageBedtime', () => {
  it('averages across midnight', () => {
    // 23:00 and 01:00 → midnight, not noon
    expect(averageBedtime([atTime('2026-11-02', '23:00'), atTime('2026-11-02', '01:00')])).toBe(
      '00:00',
    )
    expect(averageBedtime([atTime('2026-11-02', '23:00'), atTime('2026-11-03', '23:30')])).toBe(
      '23:15',
    )
  })
  it('is null without data', () => {
    expect(averageBedtime([])).toBeNull()
  })
})

describe('bedtimeBefore', () => {
  const morning = new Date('2026-11-03T07:00:00+07:00').getTime()
  it('puts evening times on the previous calendar day', () => {
    expect(bedtimeBefore(morning, '23:30')).toBe('2026-11-02T23:30:00.000+07:00')
  })
  it('puts after-midnight times on the same calendar day', () => {
    expect(bedtimeBefore(morning, '00:30')).toBe('2026-11-03T00:30:00.000+07:00')
  })
})

describe('findOpenNightSleep', () => {
  const now = new Date('2026-11-03T07:00:00+07:00').getTime()
  it('finds the open night sleep from last night', () => {
    const open = sleep('2026-11-02T23:30:00.000+07:00', null)
    expect(findOpenNightSleep([open], now)).toBe(open)
  })
  it('ignores naps, closed entries and stale ones', () => {
    expect(
      findOpenNightSleep([sleep('2026-11-03T05:00:00.000+07:00', null, { nap: true })], now),
    ).toBeUndefined()
    expect(
      findOpenNightSleep(
        [sleep('2026-11-02T23:30:00.000+07:00', '2026-11-03T06:00:00.000+07:00')],
        now,
      ),
    ).toBeUndefined()
    expect(findOpenNightSleep([sleep('2026-10-30T23:30:00.000+07:00', null)], now)).toBeUndefined()
  })
})

describe('shouldAskLastNight', () => {
  const morning = new Date('2026-11-03T08:00:00+07:00').getTime()
  it('asks in the morning when there is no recent sleep', () => {
    expect(shouldAskLastNight([], morning, 4)).toBe(true)
  })
  it('does not ask when last night was recorded', () => {
    const done = sleep('2026-11-02T23:30:00.000+07:00', '2026-11-03T06:30:00.000+07:00')
    expect(shouldAskLastNight([done], morning, 4)).toBe(false)
  })
  it('does not ask in the afternoon or before the day starts', () => {
    expect(shouldAskLastNight([], new Date('2026-11-03T15:00:00+07:00').getTime(), 4)).toBe(false)
    expect(shouldAskLastNight([], new Date('2026-11-03T02:00:00+07:00').getTime(), 4)).toBe(false)
  })
})
