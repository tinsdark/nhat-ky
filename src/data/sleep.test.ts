import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createEntry } from './repository'
import { getOpenSleep, goToSleep, setSleepQuality, suggestBedtime, wakeUp } from './sleep'

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.settings.clear(), db.meta.clear()])
})

describe('sleep flow', () => {
  it('two presses record a full night: Đi ngủ opens, Thức dậy closes', async () => {
    const opened = await goToSleep()
    expect(opened?.end).toBeNull()
    expect((await getOpenSleep())?.id).toBe(opened?.id)
    const { entry: closed, estimated } = await wakeUp()
    expect(closed.id).toBe(opened?.id)
    expect(closed.end).not.toBeNull()
    expect(estimated).toBe(false)
    expect(await getOpenSleep()).toBeUndefined()
  })

  it('does not open a second night while one is open', async () => {
    await goToSleep()
    expect(await goToSleep()).toBeNull()
    expect(await db.entries.count()).toBe(1)
  })

  it('wakeUp with no "Đi ngủ" records an estimated night instead of asking', async () => {
    const { entry, estimated } = await wakeUp()
    expect(estimated).toBe(true)
    expect(entry.payload.estimated).toBe(true)
    expect(entry.end).not.toBeNull()
    const hours = (new Date(entry.end!).getTime() - new Date(entry.start).getTime()) / 3_600_000
    expect(hours).toBeGreaterThanOrEqual(2)
    expect(hours).toBeLessThanOrEqual(14)
    expect(await getOpenSleep()).toBeUndefined()
  })

  it('stores quality in payload and rating', async () => {
    const e = await goToSleep()
    const rated = await setSleepQuality(e!.id, 4)
    expect(rated.payload.quality).toBe(4)
    expect(rated.rating).toBe(4)
  })

  it('suggests the average bedtime of recent nights, ignoring naps', async () => {
    const now = Date.now()
    expect(await suggestBedtime()).toBeNull()
    await createEntry({
      type: 'sleep',
      start: new Date(now - 36 * 3_600_000).toISOString(),
      end: new Date(now - 28 * 3_600_000).toISOString(),
    })
    expect(await suggestBedtime()).toMatch(/^\d{2}:\d{2}$/)
  })
})
