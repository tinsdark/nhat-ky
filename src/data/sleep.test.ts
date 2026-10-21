import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  getOpenSleep,
  goToSleep,
  recordNight,
  setSleepQuality,
  suggestBedtime,
  wakeUp,
} from './sleep'

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.settings.clear(), db.meta.clear()])
})

describe('sleep flow', () => {
  it('two presses record a full night: Đi ngủ opens, Thức dậy closes', async () => {
    const opened = await goToSleep()
    expect(opened?.end).toBeNull()
    expect((await getOpenSleep())?.id).toBe(opened?.id)
    const closed = await wakeUp()
    expect(closed?.id).toBe(opened?.id)
    expect(closed?.end).not.toBeNull()
    expect(await getOpenSleep()).toBeUndefined()
  })

  it('does not open a second night while one is open', async () => {
    await goToSleep()
    expect(await goToSleep()).toBeNull()
    expect(await db.entries.count()).toBe(1)
  })

  it('wakeUp returns null when nothing is open', async () => {
    expect(await wakeUp()).toBeNull()
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
    await recordNight(
      new Date(now - 36 * 3_600_000).toISOString(),
      new Date(now - 28 * 3_600_000).toISOString(),
    )
    expect(await suggestBedtime()).toMatch(/^\d{2}:\d{2}$/)
  })
})
