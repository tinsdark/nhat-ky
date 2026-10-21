import { describe, expect, it } from 'vitest'
import { dueReminders } from './reminders'
import type { Entry, Habit } from './types'

const habit = (over: Partial<Habit>): Habit => ({
  id: 'h',
  name: 'Đọc sách',
  direction: 'build',
  kind: 'check',
  target: { op: '>=', value: 1 },
  schedule: { kind: 'daily' },
  reminderTime: '22:00',
  linkedRule: null,
  startDate: '2026-11-01',
  archived: false,
  ...over,
})
const at = (iso: string) => new Date(iso).getTime()
const tick = {
  type: 'habit',
  dateKey: '2026-11-02',
  payload: { habitId: 'h' },
  value: null,
  deleted: false,
} as unknown as Entry
const run = (habits: Habit[], now: string, entries: Entry[] = []) =>
  dueReminders({
    habits,
    todayEntries: entries,
    todayKey: '2026-11-02',
    now: at(now),
    dayStartHour: 4,
  }).map((h) => h.id)

describe('dueReminders', () => {
  it('fires from the reminder time until the habit is met', () => {
    expect(run([habit({})], '2026-11-02T21:59:00+07:00')).toEqual([])
    expect(run([habit({})], '2026-11-02T22:00:00+07:00')).toEqual(['h'])
    expect(run([habit({})], '2026-11-02T22:30:00+07:00', [tick])).toEqual([])
  })
  it('still counts after midnight, before the day rolls over', () => {
    expect(run([habit({})], '2026-11-03T01:00:00+07:00')).toEqual(['h'])
  })
  it('skips habits without a time, off-schedule, archived, or computed automatically', () => {
    const now = '2026-11-02T23:00:00+07:00'
    expect(run([habit({ reminderTime: null })], now)).toEqual([])
    expect(run([habit({ schedule: { kind: 'weekdays', days: [5, 6] } })], now)).toEqual([]) // Monday
    expect(run([habit({ archived: true })], now)).toEqual([])
    expect(run([habit({ linkedRule: { entryType: 'water' } })], now)).toEqual([])
    expect(
      run([habit({ metricRule: { metricId: 'bedtime', op: '<=', value: 23.5 } })], now),
    ).toEqual([])
  })
})
