// Dev-only: write generated data into IndexedDB and wipe it again. Imported lazily behind import.meta.env.DEV.
import { addDays, toDateKey, toIso } from '../core/date'
import { db } from '../data/db'
import { getSettings } from '../data/repository'
import { FAKE_DEVICE, generateFakeData } from './fakeData'

export async function addFakeData(days: number): Promise<number> {
  const { dayStartHour } = await getSettings()
  const endKey = addDays(toDateKey(Date.now(), dayStartHour), -1)
  const data = generateFakeData({ endKey, days })
  await db.transaction('rw', db.entries, db.days, async () => {
    await db.entries.bulkPut(data.entries)
    await db.days.bulkPut(data.days)
  })
  return data.entries.length
}

/**
 * Removes the fake records. They are soft-deleted and scrubbed (not erased) so the removal also reaches
 * Drive if a month file carrying them was ever uploaded.
 */
export async function clearFakeData(): Promise<number> {
  const stamp = toIso()
  const entries = await db.entries.filter((e) => e.deviceId === FAKE_DEVICE && !e.deleted).toArray()
  const days = await db.days.filter((d) => d.deviceId === FAKE_DEVICE && !d.deleted).toArray()
  await db.transaction('rw', db.entries, db.days, async () => {
    await db.entries.bulkPut(
      entries.map((e) => ({
        ...e,
        deleted: true,
        title: '',
        note: '',
        payload: {},
        updatedAt: stamp,
        dirty: 1 as const,
      })),
    )
    await db.days.bulkPut(
      days.map((d) => ({
        ...d,
        deleted: true,
        highlight: '',
        note: '',
        updatedAt: stamp,
        dirty: 1 as const,
      })),
    )
  })
  return entries.length + days.length
}
