import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addExerciseShortcut, cleanDuplicateOpenSleeps } from './maintenance'
import { createEntry, getDefs, saveDefs } from './repository'
import { defaultDefs } from '../core/defaults'

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.settings.clear(), db.meta.clear(), db.defs.clear()])
})

describe('cleanDuplicateOpenSleeps', () => {
  it('soft-deletes the open twin once and marks it dirty', async () => {
    const start = '2026-11-02T23:30:00.000+07:00'
    await createEntry({ type: 'sleep', start, end: '2026-11-03T07:00:00.000+07:00' })
    const twin = await createEntry({ type: 'sleep', start })
    expect(await cleanDuplicateOpenSleeps()).toBe(1)
    const row = await db.entries.get(twin.id)
    expect(row?.deleted).toBe(true)
    expect(row?.dirty).toBe(1)
    // runs once per device
    await createEntry({ type: 'sleep', start })
    expect(await cleanDuplicateOpenSleeps()).toBe(0)
  })
})

describe('addExerciseShortcut', () => {
  it('adds the shortcut once to old defs and marks defs dirty', async () => {
    const d = defaultDefs('2026-10-21')
    await saveDefs({ ...d, quickActions: d.quickActions.filter((a) => a.type !== 'exercise') })
    expect(await addExerciseShortcut()).toBe(true)
    expect((await getDefs()).quickActions.some((a) => a.type === 'exercise')).toBe(true)
    expect((await db.defs.get('defs'))?.dirty).toBe(1)
    // deleted again by the user: not re-added
    await saveDefs({ ...d, quickActions: d.quickActions.filter((a) => a.type !== 'exercise') })
    expect(await addExerciseShortcut()).toBe(false)
  })
  it('does nothing before the seed', async () => {
    expect(await addExerciseShortcut()).toBe(false)
    expect(await db.meta.count()).toBe(0)
  })
})
