// When the background timer should sync (SPEC: every 60 s while there are local changes).

export const POLL_MS = 60_000
/** With nothing to push, still look for changes from other devices, just less often. */
export const IDLE_POLL_MS = 5 * 60_000

export function pollDue(opts: { pending: boolean; sinceLastRunMs: number }): boolean {
  return opts.pending || opts.sinceLastRunMs >= IDLE_POLL_MS
}
