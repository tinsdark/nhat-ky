import { toIso } from '../core/date'
import {
  backupCopy,
  inPurgeRange,
  scrubbedDay,
  scrubbedEntry,
  type PurgeRange,
} from '../core/purge'
import type { Day, Entry } from '../core/types'
import { SNAPSHOT_VERSION, type Snapshot } from '../backup/snapshot'
import { db } from './db'
import { getDeviceId } from './repository'

export interface PurgePlan {
  range: PurgeRange
  /** Time of the deletion, shared by the backup file and the scrubbed records. */
  stamp: string
  entryIds: string[]
  dayKeys: string[]
  /** Photos only the deleted entries use. */
  photoIds: string[]
  /** The records as they are now, in the format of "Khôi phục từ JSON". */
  backup: Snapshot
}

const strip = <T extends { dirty: unknown }>(r: T): Omit<T, 'dirty'> => {
  const { dirty, ...rest } = r // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest
}

/** What a purge of `range` would remove, without removing anything. */
export async function planPurge(range: PurgeRange): Promise<PurgePlan> {
  const stamp = toIso()
  const entries: Entry[] = (await db.entries.filter((e) => !e.deleted).toArray()).filter((e) =>
    inPurgeRange(e.dateKey, range),
  )
  const days: Day[] = (await db.days.filter((d) => !d.deleted).toArray()).filter((d) =>
    inPurgeRange(d.dateKey, range),
  )
  const doomed = new Set(entries.map((e) => e.id))
  // A photo that a surviving entry also points to (a duplicated entry) must stay.
  const kept = new Set<string>()
  await db.entries.each((e) => {
    if (!e.deleted && !doomed.has(e.id)) for (const id of e.photoIds) kept.add(id)
  })
  const photoIds = [...new Set(entries.flatMap((e) => e.photoIds))].filter((id) => !kept.has(id))
  return {
    range,
    stamp,
    entryIds: entries.map((e) => e.id),
    dayKeys: days.map((d) => d.dateKey),
    photoIds,
    backup: {
      version: SNAPSHOT_VERSION,
      createdAt: stamp,
      deviceId: await getDeviceId(),
      entries: entries.map((e) => strip(backupCopy(e, stamp))),
      days: days.map((d) => strip(backupCopy(d, stamp))),
      docs: {},
    },
  }
}

/** Soft-deletes and scrubs the planned records, then removes their photos. Records already gone are skipped. */
export async function executePurge(
  plan: PurgePlan,
  removePhotos: (ids: string[]) => Promise<void>,
): Promise<{ entries: number; days: number; photos: number }> {
  const deviceId = await getDeviceId()
  let entries = 0
  let days = 0
  await db.transaction('rw', db.entries, db.days, async () => {
    for (const e of await db.entries.bulkGet(plan.entryIds)) {
      if (!e || e.deleted) continue
      await db.entries.put(scrubbedEntry(e, plan.stamp, deviceId))
      entries++
    }
    for (const d of await db.days.bulkGet(plan.dayKeys)) {
      if (!d || d.deleted) continue
      await db.days.put(scrubbedDay(d, plan.stamp, deviceId))
      days++
    }
  })
  await removePhotos(plan.photoIds)
  return { entries, days, photos: plan.photoIds.length }
}
