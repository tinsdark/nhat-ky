import { isOvertime } from '../core/timer'
import { toIso } from '../core/date'
import type { Entry, Rating } from '../core/types'
import { db } from './db'
import { createEntry, getSettings, updateEntry } from './repository'

/**
 * The timer lives in IndexedDB as an open entry (`source = 'timer'`, `end = null`), so reload,
 * closing the app and sync all keep it. At most one exists at a time.
 */
export async function getRunningTimer(): Promise<Entry | undefined> {
  const rows = await db.entries.where('type').equals('work').toArray()
  return rows.find((e) => e.source === 'timer' && e.end === null && !e.deleted)
}

export async function stopTimer(id: string, focus?: Rating | null): Promise<Entry> {
  const current = await db.entries.get(id)
  if (!current) throw new Error(`Entry not found: ${id}`)
  const end = toIso()
  const settings = await getSettings()
  const payload: Record<string, unknown> = {
    ...current.payload,
    isOvertime: isOvertime(current.start, end, settings),
  }
  if (focus != null) payload.focus = focus
  return updateEntry(id, { end, payload })
}

/** Starts a work timer; a timer already running is stopped first. */
export async function startTimer(
  fields: { categoryId?: string; title?: string } = {},
): Promise<{ entry: Entry; stopped: Entry | null }> {
  const running = await getRunningTimer()
  const stopped = running ? await stopTimer(running.id) : null
  const entry = await createEntry({
    type: 'work',
    start: toIso(),
    source: 'timer',
    categoryId: fields.categoryId ?? '',
    title: fields.title ?? '',
    payload: { interruptions: 0 },
  })
  return { entry, stopped }
}

export async function addInterruption(id: string): Promise<Entry> {
  const current = await db.entries.get(id)
  if (!current) throw new Error(`Entry not found: ${id}`)
  const n = Number(current.payload.interruptions ?? 0) + 1
  return updateEntry(id, { payload: { ...current.payload, interruptions: n } })
}

export async function setFocus(id: string, focus: Rating): Promise<Entry> {
  const current = await db.entries.get(id)
  if (!current) throw new Error(`Entry not found: ${id}`)
  return updateEntry(id, { payload: { ...current.payload, focus } })
}
