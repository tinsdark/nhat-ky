import { defaultDefs } from '../core/defaults'
import { toDateKey } from '../core/date'
import { DEFAULT_SETTINGS } from '../core/settings'
import { db } from './db'
import { getDeviceId } from './repository'

/** Older than any real edit, so a record pulled from Drive always wins the merge. */
const SEED_STAMP = new Date(0).toISOString()

/**
 * First run only: fills defs and settings when the tables have no row.
 * Seed rows are stamped with epoch and dirty = 0: they never upload on their own, and a real
 * copy from another device overwrites them on the first sync.
 */
export async function seedDefaults(): Promise<void> {
  const deviceId = await getDeviceId()
  const startDate = toDateKey(Date.now(), DEFAULT_SETTINGS.dayStartHour)
  await db.transaction('rw', db.defs, db.settings, async () => {
    if (!(await db.defs.get('defs'))) {
      await db.defs.add({
        ...defaultDefs(startDate),
        key: 'defs',
        updatedAt: SEED_STAMP,
        deviceId,
        dirty: 0,
      })
    }
    if (!(await db.settings.get('settings'))) {
      await db.settings.add({
        ...DEFAULT_SETTINGS,
        key: 'settings',
        updatedAt: SEED_STAMP,
        deviceId,
        dirty: 0,
      })
    }
  })
}
