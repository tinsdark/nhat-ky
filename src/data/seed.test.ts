import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { getDefs, getSettings, saveDefs } from './repository'
import { seedDefaults } from './seed'

beforeEach(async () => {
  await Promise.all([db.defs.clear(), db.settings.clear(), db.meta.clear()])
})

describe('seedDefaults', () => {
  it('fills defs and settings with epoch stamp and dirty = 0', async () => {
    await seedDefaults()
    const defs = await db.defs.get('defs')
    const settings = await db.settings.get('settings')
    expect(defs?.dirty).toBe(0)
    expect(defs?.updatedAt).toBe('1970-01-01T00:00:00.000Z')
    expect(settings?.dirty).toBe(0)
    expect((await getSettings()).dayStartHour).toBe(4)
    expect((await getDefs()).quickActions.length).toBeGreaterThan(0)
  })

  it('does not overwrite existing data', async () => {
    await saveDefs({ categories: [], habits: [], quickActions: [], tags: [] })
    await seedDefaults()
    expect((await getDefs()).quickActions).toEqual([])
    expect((await db.defs.get('defs'))?.dirty).toBe(1)
  })
})
