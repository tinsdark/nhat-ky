import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { valuesByDate } from '../core/habits'
import type { Habit } from '../core/types'
import { db } from './db'
import { tickHabit, untickHabit, upsertHabit } from './habits'
import { getDefs, getEntriesInRange } from './repository'

const habit: Habit = {
  id: 'h1',
  name: 'Đọc sách 20 phút',
  direction: 'build',
  kind: 'duration',
  target: { op: '>=', value: 20 },
  schedule: { kind: 'daily' },
  reminderTime: null,
  linkedRule: null,
  startDate: '2026-01-01',
  archived: false,
}

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.defs.clear(), db.settings.clear(), db.meta.clear()])
})

describe('habit ticks', () => {
  it('a duration tick adds the target minutes and shows up in valuesByDate', async () => {
    const e = await tickHabit(habit, '2026-11-02', 4)
    expect(e.value).toBe(20)
    const entries = await getEntriesInRange(e.dateKey, e.dateKey)
    expect(valuesByDate(habit, entries).get(e.dateKey)).toBe(20)
  })

  it('unticks the latest tick only', async () => {
    const a = await tickHabit(habit, '2026-11-02', 4, 5)
    await tickHabit(habit, a.dateKey, 4, 7)
    await untickHabit(habit, a.dateKey)
    const entries = await getEntriesInRange(a.dateKey, a.dateKey)
    expect(valuesByDate(habit, entries).get(a.dateKey)).toBe(5)
  })

  it('upsertHabit adds then edits in place', async () => {
    await upsertHabit(habit)
    await upsertHabit({ ...habit, name: 'Đọc 30 phút' })
    const habits = (await getDefs()).habits
    expect(habits).toHaveLength(1)
    expect(habits[0]!.name).toBe('Đọc 30 phút')
  })
})
