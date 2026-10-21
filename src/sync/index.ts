import { hasSession, onAuthRequired } from '../auth'
import { db } from '../data/db'
import { getModifiedTime, listFiles, readJson, writeJson } from '../drive'
import { createSyncEngine } from './engine'

export type { SyncStatus } from './engine'

export const engine = createSyncEngine({
  db,
  drive: { listFiles, readJson, writeJson, getModifiedTime },
})

const POLL_MS = 60_000

/** Call once at app start. Sync runs on open, tab visible, back online, and every 60s while visible. */
export function startSync(): void {
  onAuthRequired(() => engine.markAuthRequired())

  // While signed out every attempt would try a silent token request; wait for an explicit sign-in.
  const auto = () => {
    if (engine.getStatus().state !== 'authRequired') void engine.run()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') auto()
  })
  window.addEventListener('online', auto)
  setInterval(() => {
    if (document.visibilityState === 'visible') auto()
  }, POLL_MS)

  if (hasSession()) void engine.run()
  else engine.markAuthRequired()
}
