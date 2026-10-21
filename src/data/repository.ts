import { DEFAULT_SETTINGS } from '../core/settings'
import { toDateKey, toIso } from '../core/date'
import { isOvertime } from '../core/overtime'
import { runningEntries } from '../core/running'
import type { Day, Defs, Entry, Settings } from '../core/types'
import { db } from './db'

export type NewEntry = Pick<Entry, 'type' | 'start'> &
  Partial<
    Omit<
      Entry,
      | 'type'
      | 'start'
      | 'id'
      | 'dateKey'
      | 'createdAt'
      | 'updatedAt'
      | 'deviceId'
      | 'deleted'
      | 'dirty'
    >
  >

/**
 * Final shape of an entry before it is stored: times always carry the +07:00 offset whatever form the
 * caller passed (CLAUDE.md rule 7), and work blocks carry `payload.isOvertime`, derived from the
 * working hours in Settings (SPEC 4.2).
 */
function withOvertime(input: Entry, settings: Settings): Entry {
  const entry = {
    ...input,
    start: toIso(new Date(input.start)),
    end: input.end ? toIso(new Date(input.end)) : null,
  }
  if (entry.type !== 'work' || entry.end === null) return entry
  return {
    ...entry,
    payload: { ...entry.payload, isOvertime: isOvertime(entry.start, entry.end, settings) },
  }
}

export async function getDeviceId(): Promise<string> {
  return db.transaction('rw', db.meta, async () => {
    const row = await db.meta.get('deviceId')
    if (row) return row.value as string
    const id = crypto.randomUUID()
    await db.meta.put({ key: 'deviceId', value: id })
    return id
  })
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings')
  if (!row) return { ...DEFAULT_SETTINGS }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key, updatedAt, deviceId, dirty, ...settings } = row
  // Fills fields added after this row was written (e.g. by another device on an older version).
  return { ...DEFAULT_SETTINGS, ...settings }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await getSettings()), ...patch }
  await db.settings.put({
    ...next,
    key: 'settings',
    updatedAt: toIso(),
    deviceId: await getDeviceId(),
    dirty: 1,
  })
}

export async function getDefs(): Promise<Defs> {
  const row = await db.defs.get('defs')
  if (!row) return { categories: [], habits: [], quickActions: [], tags: [] }
  const { categories, habits, quickActions, tags, customTypes } = row
  return { categories, habits, quickActions, tags, ...(customTypes && { customTypes }) }
}

export async function saveDefs(defs: Defs): Promise<void> {
  await db.defs.put({
    ...defs,
    key: 'defs',
    updatedAt: toIso(),
    deviceId: await getDeviceId(),
    dirty: 1,
  })
}

export async function createEntry(input: NewEntry): Promise<Entry> {
  const now = toIso()
  const settings = await getSettings()
  const { dayStartHour } = settings
  const entry: Entry = {
    end: null,
    categoryId: '',
    title: '',
    value: null,
    unit: '',
    rating: null,
    tags: [],
    photoIds: [],
    payload: {},
    source: 'manual',
    note: '',
    ...input,
    id: crypto.randomUUID(),
    dateKey: toDateKey(input.start, dayStartHour),
    createdAt: now,
    updatedAt: now,
    deviceId: await getDeviceId(),
    deleted: false,
    dirty: 1,
  }
  const saved = withOvertime(entry, settings)
  await db.entries.add(saved)
  return saved
}

export async function updateEntry(id: string, patch: Partial<NewEntry>): Promise<Entry> {
  const current = await db.entries.get(id)
  if (!current) throw new Error(`Entry not found: ${id}`)
  const next: Entry = {
    ...current,
    ...patch,
    updatedAt: toIso(),
    deviceId: await getDeviceId(),
    dirty: 1,
  }
  const settings = await getSettings()
  if (patch.start !== undefined) next.dateKey = toDateKey(next.start, settings.dayStartHour)
  const saved = withOvertime(next, settings)
  await db.entries.put(saved)
  return saved
}

/** Blocks that were started and not yet ended, from any day. */
export async function getRunningEntries(): Promise<Entry[]> {
  return runningEntries(await db.entries.filter((e) => e.payload.running === true).toArray())
}

export async function softDeleteEntry(id: string): Promise<void> {
  const current = await db.entries.get(id)
  if (!current) throw new Error(`Entry not found: ${id}`)
  await db.entries.put({
    ...current,
    deleted: true,
    updatedAt: toIso(),
    deviceId: await getDeviceId(),
    dirty: 1,
  })
}

/** Undo for softDeleteEntry. */
export async function restoreEntry(id: string): Promise<void> {
  const current = await db.entries.get(id)
  if (!current) throw new Error(`Entry not found: ${id}`)
  await db.entries.put({
    ...current,
    deleted: false,
    updatedAt: toIso(),
    deviceId: await getDeviceId(),
    dirty: 1,
  })
}

export function getEntriesByDateKey(dateKey: string): Promise<Entry[]> {
  return getEntriesInRange(dateKey, dateKey)
}

/** Live entries with dateKey in [from, to], ordered by start. */
export async function getEntriesInRange(from: string, to: string): Promise<Entry[]> {
  const rows = await db.entries.where('dateKey').between(from, to, true, true).toArray()
  return rows.filter((e) => !e.deleted).sort((a, b) => a.start.localeCompare(b.start))
}

export async function saveDay(
  dateKey: string,
  patch: Partial<
    Omit<Day, 'dateKey' | 'createdAt' | 'updatedAt' | 'deviceId' | 'deleted' | 'dirty'>
  >,
): Promise<Day> {
  const now = toIso()
  const current = await db.days.get(dateKey)
  const day: Day = {
    mood: null,
    energy: null,
    stress: null,
    focus: null,
    dayScore: null,
    highlight: '',
    dayType: null,
    note: '',
    createdAt: now,
    ...current,
    ...patch,
    dateKey,
    updatedAt: now,
    deviceId: await getDeviceId(),
    deleted: false,
    dirty: 1,
  }
  await db.days.put(day)
  return day
}

export async function getDay(dateKey: string): Promise<Day | undefined> {
  const day = await db.days.get(dateKey)
  return day && !day.deleted ? day : undefined
}

export async function getDaysInRange(from: string, to: string): Promise<Day[]> {
  const rows = await db.days.where('dateKey').between(from, to, true, true).toArray()
  return rows.filter((d) => !d.deleted)
}

/**
 * Moves the day cut to `hour` (SPEC: "Giờ cắt chỉnh được trong cài đặt"). Every entry's `dateKey` is
 * recomputed from its start, since the key is only ever derived from toDateKey. Day ratings stay under
 * the dateKey they were given. Entries that move are marked dirty so other devices follow.
 */
export async function changeDayStartHour(hour: number): Promise<number> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 8)
    throw new Error(`Invalid day start hour: ${hour}`)
  const deviceId = await getDeviceId()
  const stamp = toIso()
  let moved = 0
  await db.transaction('rw', db.entries, db.settings, db.meta, async () => {
    const changed: Entry[] = []
    await db.entries.each((e) => {
      const dateKey = toDateKey(e.start, hour)
      if (dateKey !== e.dateKey)
        changed.push({ ...e, dateKey, updatedAt: stamp, deviceId, dirty: 1 })
    })
    await db.entries.bulkPut(changed)
    moved = changed.length
    const next = { ...(await getSettings()), dayStartHour: hour }
    await db.settings.put({ ...next, key: 'settings', updatedAt: stamp, deviceId, dirty: 1 })
  })
  return moved
}
