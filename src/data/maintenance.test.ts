import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { cleanDuplicateOpenSleeps } from './maintenance'
import { createEntry } from './repository'

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.settings.clear(), db.meta.clear()])
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
