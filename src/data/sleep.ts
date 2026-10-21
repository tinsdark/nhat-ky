import { addDays, toDateKey, toIso } from '../core/date'
import { averageBedtime, findOpenNightSleep } from '../core/sleep'
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

/** "Thức dậy": closes the open night sleep, or returns null when there is none to close. */
export async function wakeUp(): Promise<Entry | null> {
  const open = await getOpenSleep()
  if (!open) return null
  return updateEntry(open.id, { end: toIso(), title: 'Ngủ đêm' })
}

export function recordNight(start: string, end: string): Promise<Entry> {
  return createEntry({
    type: 'sleep',
    start,
    end,
    categoryId: SLEEP_CATEGORY,
    title: 'Ngủ đêm',
    source: 'manual',
  })
}

export async function setSleepQuality(id: string, quality: Rating): Promise<Entry> {
  const current = await db.entries.get(id)
  if (!current) throw new Error(`Entry not found: ${id}`)
  return updateEntry(id, { payload: { ...current.payload, quality }, rating: quality })
}
