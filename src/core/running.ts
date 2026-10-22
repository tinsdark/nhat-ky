import { MAX_BLOCK_HOURS } from './entryForm'
import type { Entry, EntryType } from './types'

/** Types that last a while, so pressing once records the start and a second press records the end. */
export function isTimedType(type: EntryType): boolean {
  return (
    type === 'meal' ||
    type === 'work' ||
    type === 'study' ||
    type === 'activity' ||
    type === 'exercise' ||
    type.startsWith('x-')
  )
}

/** A block whose start was recorded and whose end is still waiting for the second press. */
export const isRunning = (e: Entry): boolean =>
  !e.deleted && e.end === null && e.payload.running === true

export const runningEntries = (entries: Entry[]): Entry[] =>
  entries.filter(isRunning).sort((a, b) => a.start.localeCompare(b.start))

/** Payload of a block that has just been started. */
export const startRunning = (payload: Entry['payload']): Entry['payload'] => ({
  ...payload,
  running: true,
})

/** Payload without the running flag. */
export function stopRunning(payload: Entry['payload']): Entry['payload'] {
  const rest = { ...payload }
  delete rest.running
  return rest
}

/**
 * Fields that close a running block at `nowIso`. Null when the block is not running, or would be
 * longer than the form accepts (a forgotten press): the caller then asks for the end time by hand.
 */
export function finishPatch(
  entry: Entry,
  nowIso: string,
): { end: string; payload: Entry['payload'] } | null {
  if (!isRunning(entry)) return null
  const ms = new Date(nowIso).getTime() - new Date(entry.start).getTime()
  if (ms <= 0 || ms > MAX_BLOCK_HOURS * 3_600_000) return null
  return { end: nowIso, payload: stopRunning(entry.payload) }
}
