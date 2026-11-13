// One-time clean-ups of data written by older versions. Each runs once per device (flag in meta) and
// only soft-deletes, so the change syncs and a backup still has the records.
import { DEFAULT_QUICK_ACTIONS } from '../core/defaults'
import { withExerciseShortcut } from '../core/defs'
import { duplicateOpenSleeps } from '../core/sleep'
import { db } from './db'
import { getDefs, saveDefs, softDeleteEntry } from './repository'

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

const EXERCISE_FLAG = 'migrate:exerciseShortcut:v1'

/**
 * Adds the "Vận động" shortcut on devices seeded before it was a default. Run only once this device's
 * defs are current (after a sync, or when not signed in): defs merge by file, and an edit stamped on a
 * stale copy would win over quick-action changes made on another device.
 */
export async function addExerciseShortcut(): Promise<boolean> {
  if (await db.meta.get(EXERCISE_FLAG)) return false
  const row = await db.defs.get('defs')
  if (!row) return false // not seeded yet
  const next = withExerciseShortcut(
    await getDefs(),
    DEFAULT_QUICK_ACTIONS.find((a) => a.id === 'qa-exercise')!,
  )
  if (next) await saveDefs(next)
  await db.meta.put({ key: EXERCISE_FLAG, value: !!next })
  return !!next
}
