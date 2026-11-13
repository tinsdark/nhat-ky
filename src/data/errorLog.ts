import { toIso } from '../core/date'
import { appendError, errorMessage, type ErrorLogLine } from '../core/errorLog'
import { db } from './db'

const KEY = 'errorLog'

/** Records an error on this device (meta table, never synced). Never throws. */
export async function logError(where: string, err: unknown): Promise<void> {
  console.warn(where, err)
  try {
    await db.transaction('rw', db.meta, async () => {
      const log = ((await db.meta.get(KEY))?.value as ErrorLogLine[] | undefined) ?? []
      await db.meta.put({
        key: KEY,
        value: appendError(log, { at: toIso(), where, message: errorMessage(err) }),
      })
    })
  } catch {
    // IndexedDB itself is failing: the console line above is all there is
  }
}

export async function getErrorLog(): Promise<ErrorLogLine[]> {
  return ((await db.meta.get(KEY))?.value as ErrorLogLine[] | undefined) ?? []
}

export async function clearErrorLog(): Promise<void> {
  await db.meta.delete(KEY)
}
