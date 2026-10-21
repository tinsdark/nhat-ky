import { addDays, toDateKey, toIso } from '../core/date'
import { averageBedtime, estimateBedtime, findOpenNightSleep } from '../core/sleep'
import type { Entry, Rating } from '../core/types'
import { db } from './db'
import { createEntry, getSettings, updateEntry } from './repository'

export const SLEEP_CATEGORY = 'cat-sleep'

/** Sleep entries from the last 8 logical days, enough to find an open one and a 7-day bedtime average. */
export async function getRecentSleep(now = Date.now()): Promise<Entry[]> {
  const { dayStartHour } = await getSettings()
  const from = addDays(toDateKey(now, dayStartHour), -8)
  const rows = await db.entries
    .where('[type+dateKey]')
    .between(['sleep', from], ['sleep', '￿'])
    .toArray()
  return rows.filter((e) => !e.deleted)
}

export async function getOpenSleep(): Promise<Entry | undefined> {
  return findOpenNightSleep(await getRecentSleep(), Date.now())
}

/** Bed time suggestion for the "forgot to press" prompt: mean bedtime of the last 7 days. */
export async function suggestBedtime(): Promise<string | null> {
  const nights = (await getRecentSleep()).filter((e) => e.payload.nap !== true)
  return averageBedtime(nights.map((e) => e.start))
}

/** "Đi ngủ": an open entry with only `start`. Returns null when a night sleep is already open. */
export async function goToSleep(): Promise<Entry | null> {
  if (await getOpenSleep()) return null
  return createEntry({
    type: 'sleep',
    start: toIso(),
    categoryId: SLEEP_CATEGORY,
    title: 'Đi ngủ',
    source: 'quick',
  })
}

/**
 * "Thức dậy": closes the open night sleep. With none open (the "Đi ngủ" press was forgotten) it
 * records a night anyway, with an estimated bedtime and `payload.estimated`: no question is asked.
 */
export async function wakeUp(): Promise<{ entry: Entry; estimated: boolean }> {
  const open = await getOpenSleep()
  if (open)
    return {
      entry: await updateEntry(open.id, { end: toIso(), title: 'Ngủ đêm' }),
      estimated: false,
    }
  const { sleepTargetHours } = await getSettings()
  const now = Date.now()
  const entry = await createEntry({
    type: 'sleep',
    start: estimateBedtime(now, await suggestBedtime(), sleepTargetHours),
    end: toIso(now),
    categoryId: SLEEP_CATEGORY,
    title: 'Ngủ đêm',
    source: 'quick',
    payload: { estimated: true },
  })
  return { entry, estimated: true }
}

export async function setSleepQuality(id: string, quality: Rating): Promise<Entry> {
  const current = await db.entries.get(id)
  if (!current) throw new Error(`Entry not found: ${id}`)
  return updateEntry(id, { payload: { ...current.payload, quality }, rating: quality })
}
