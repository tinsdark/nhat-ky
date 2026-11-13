import { describe, expect, it } from 'vitest'
import { atTime } from './date'
import {
  averageBedtime,
  bedtimeBefore,
  estimateBedtime,
  duplicateOpenSleeps,
  findOpenNightSleep,
  justWoken,
} from './sleep'
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
    // forgotten "Thức dậy" from yesterday morning: 20h old, over the 16h cap
    expect(findOpenNightSleep([sleep('2026-11-02T11:00:00.000+07:00', null)], now)).toBeUndefined()
  })
})

describe('justWoken', () => {
  const now = new Date('2026-11-03T07:05:00+07:00').getTime()
  it('finds the night that ended minutes ago', () => {
    const night = sleep('2026-11-02T23:30:00.000+07:00', '2026-11-03T07:00:00.000+07:00')
    expect(justWoken([night], now)).toBe(night)
  })
  it('ignores older wake-ups and naps', () => {
    expect(
      justWoken([sleep('2026-11-02T23:30:00.000+07:00', '2026-11-03T06:30:00.000+07:00')], now),
    ).toBeUndefined()
    expect(
      justWoken(
        [sleep('2026-11-03T06:00:00.000+07:00', '2026-11-03T07:00:00.000+07:00', { nap: true })],
        now,
      ),
    ).toBeUndefined()
  })
})

describe('estimateBedtime', () => {
  const morning = new Date('2026-11-03T07:00:00+07:00').getTime()
  it('uses the usual bedtime when the night is believable', () => {
    expect(estimateBedtime(morning, '23:30', 7.5)).toBe('2026-11-02T23:30:00.000+07:00')
    expect(estimateBedtime(morning, '00:30', 7.5)).toBe('2026-11-03T00:30:00.000+07:00')
  })
  it('falls back to the sleep target without a usual bedtime', () => {
    expect(estimateBedtime(morning, null, 7.5)).toBe('2026-11-02T23:30:00.000+07:00')
  })
  it('falls back when the usual bedtime gives an implausible night (pressed in the afternoon)', () => {
    const afternoon = new Date('2026-11-03T15:00:00+07:00').getTime() // usual bed would be 15.5h ago
    expect(estimateBedtime(afternoon, '23:30', 7.5)).toBe('2026-11-03T07:30:00.000+07:00')
    const justAfter = new Date('2026-11-03T01:00:00+07:00').getTime() // 1.5h of sleep: too short
    expect(estimateBedtime(justAfter, '23:30', 7.5)).toBe('2026-11-02T17:30:00.000+07:00')
  })
})

describe('duplicateOpenSleeps', () => {
  const e = (id: string, start: string, end: string | null, createdAt = start, payload = {}) =>
    ({ ...sleep(start, end, payload), id, createdAt }) as Entry
  it('drops the open twin of a closed night', () => {
    const closed = e('a', '2026-11-02T23:30:00.000+07:00', '2026-11-03T07:00:00.000+07:00')
    const twin = e('b', '2026-11-02T23:30:00.400+07:00', null)
    expect(duplicateOpenSleeps([closed, twin])).toEqual(['b'])
  })
  it('two open twins keep the first created', () => {
    const a = e('a', '2026-11-02T23:30:00.000+07:00', null, '2026-11-02T23:30:00.000+07:00')
    const b = e('b', '2026-11-02T23:30:00.300+07:00', null, '2026-11-02T23:30:00.300+07:00')
    expect(duplicateOpenSleeps([b, a])).toEqual(['b'])
  })
  it('leaves separate nights, naps and closed pairs alone', () => {
    const n1 = e('a', '2026-11-01T23:30:00.000+07:00', null)
    const n2 = e('b', '2026-11-02T23:30:00.000+07:00', null)
    const nap = e('c', '2026-11-02T23:30:30.000+07:00', null, undefined, { nap: true })
    const c1 = e('d', '2026-11-03T23:00:00.000+07:00', '2026-11-04T06:00:00.000+07:00')
    const c2 = e('e', '2026-11-03T23:00:30.000+07:00', '2026-11-04T06:30:00.000+07:00')
    expect(duplicateOpenSleeps([n1, n2, nap, c1, c2])).toEqual([])
  })
})
