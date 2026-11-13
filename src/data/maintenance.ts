// One-time clean-ups of data written by older versions. Each runs once per device (flag in meta) and
// only soft-deletes, so the change syncs and a backup still has the records.
import { duplicateOpenSleeps } from '../core/sleep'
import { db } from './db'
import { softDeleteEntry } from './repository'

const DUP_SLEEP_FLAG = 'cleanup:dupOpenSleep:v1'

/** Removes open nights left by double-taps on "Đi ngủ" (fixed in T8.2). Returns how many. */
export async function cleanDuplicateOpenSleeps(): Promise<number> {
  if (await db.meta.get(DUP_SLEEP_FLAG)) return 0
  const sleeps = await db.entries.where('type').equals('sleep').toArray()
  const ids = duplicateOpenSleeps(sleeps)
  for (const id of ids) await softDeleteEntry(id)
  await db.meta.put({ key: DUP_SLEEP_FLAG, value: ids.length })
  return ids.length
}

export async function runMaintenance(): Promise<void> {
  await cleanDuplicateOpenSleeps()
}
