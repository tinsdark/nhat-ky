import { compareVersion } from '../core/merge'
import { toIso } from '../core/date'
import { isDay, isDocStamp, isEntry, keepValid } from '../core/validate'
import type { Day, Entry } from '../core/types'
import { db } from '../data/db'
import { getDeviceId } from '../data/repository'

export const SNAPSHOT_VERSION = 1

type Local = { dirty?: unknown }
const strip = <T extends Local>(r: T): Omit<T, 'dirty'> => {
  const { dirty, ...rest } = r // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest
}

export interface Snapshot {
  version: number
  createdAt: string
  deviceId: string
  entries: Omit<Entry, 'dirty'>[]
  days: Omit<Day, 'dirty'>[]
  /** Whole-file documents as stored, minus the local `dirty` flag. */
  docs: { defs?: object; settings?: object; insights?: object }
}

/** Every record, including soft-deleted ones (so a restore also restores deletions). No photos. */
export async function buildSnapshot(): Promise<Snapshot> {
  const [entries, days, defs, settings, insights] = await Promise.all([
    db.entries.toArray(),
    db.days.toArray(),
    db.defs.get('defs'),
    db.settings.get('settings'),
    db.insights.get('insights'),
  ])
  return {
    version: SNAPSHOT_VERSION,
    createdAt: toIso(),
    deviceId: await getDeviceId(),
    entries: entries.map(strip),
    days: days.map(strip),
    docs: {
      ...(defs && { defs: strip(defs) }),
      ...(settings && { settings: strip(settings) }),
      ...(insights && { insights: strip(insights) }),
    },
  }
}

export class SnapshotError extends Error {}

export function parseSnapshot(text: string): Snapshot {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new SnapshotError('File không phải JSON hợp lệ.')
  }
  const s = data as Partial<Snapshot>
  if (
    !s ||
    typeof s !== 'object' ||
    s.version !== SNAPSHOT_VERSION ||
    !Array.isArray(s.entries) ||
    !Array.isArray(s.days)
  ) {
    throw new SnapshotError('Đây không phải file sao lưu của Nhật ký (hoặc phiên bản không khớp).')
  }
  return { ...(s as Snapshot), docs: s.docs ?? {} }
}

export interface RestoreResult {
  entries: number
  days: number
  docs: number
  /** Records dropped for a wrong shape or an `updatedAt` far in the future. */
  skipped: number
}

/**
 * Restores a snapshot by merging: a record is taken only when it is newer than the local one (same rule
 * as sync), and marked dirty so it uploads. Nothing local is deleted.
 */
export async function restoreSnapshot(snap: Snapshot): Promise<RestoreResult> {
  const result: RestoreResult = { entries: 0, days: 0, docs: 0, skipped: 0 }
  const entries = keepValid(snap.entries, isEntry)
  const days = keepValid(snap.days, isDay)
  result.skipped = entries.skipped + days.skipped
  await db.transaction('rw', [db.entries, db.days, db.defs, db.settings, db.insights], async () => {
    for (const e of entries.valid) {
      const cur = await db.entries.get(e.id)
      if (!cur || compareVersion(e, cur) > 0) {
        await db.entries.put({ ...e, dirty: 1 })
        result.entries++
      }
    }
    for (const d of days.valid) {
      const cur = await db.days.get(d.dateKey)
      if (!cur || compareVersion(d, cur) > 0) {
        await db.days.put({ ...d, dirty: 1 })
        result.days++
      }
    }
    const docs = [
      ['defs', db.defs],
      ['settings', db.settings],
      ['insights', db.insights],
    ] as const
    for (const [key, table] of docs) {
      const incoming = snap.docs[key] as { updatedAt: string; deviceId: string } | undefined
      if (!incoming) continue
      if (!isDocStamp(incoming)) {
        result.skipped++
        continue
      }
      const cur = await table.get(key)
      if (!cur || compareVersion(incoming, cur) > 0) {
        await (table as typeof db.defs).put({ ...incoming, key, dirty: 1 } as never)
        result.docs++
      }
    }
  })
  return result
}
