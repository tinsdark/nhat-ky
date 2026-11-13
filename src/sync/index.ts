import { hasSession, onAuthRequired } from '../auth'
import { db } from '../data/db'
import { getModifiedTime, listFiles, readJson, writeJson } from '../drive'
import { createSyncEngine } from './engine'
import { POLL_MS, pollDue } from '../core/syncSchedule'
import { logError } from '../data/errorLog'

export type { SyncStatus } from './engine'

export const engine = createSyncEngine({
  db,
  drive: { listFiles, readJson, writeJson, getModifiedTime },
  onError: (err) => void logError('sync', err),
})

/** True when something written on this device has not reached Drive yet. */
async function hasPending(): Promise<boolean> {
  if ((await db.entries.where('dirty').equals(1).count()) > 0) return true
  if ((await db.days.where('dirty').equals(1).count()) > 0) return true
  const docs = await Promise.all([
    db.defs.get('defs'),
    db.settings.get('settings'),
    db.insights.get('insights'),
  ])
  return docs.some((d) => d?.dirty === 1)
}

/**
 * Call once at app start. Sync runs on open, tab visible, back online; while visible, every 60 s when
 * there are local changes and every 5 minutes otherwise.
 */
export function startSync(): void {
  onAuthRequired(() => engine.markAuthRequired())

  // While signed out every attempt would try a silent token request; wait for an explicit sign-in.
  let lastRun = 0
  const auto = () => {
    if (engine.getStatus().state === 'authRequired') return
    lastRun = Date.now()
    void engine.run()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') auto()
  })
  window.addEventListener('online', auto)
  setInterval(() => {
    if (document.visibilityState !== 'visible') return
    void hasPending().then((pending) => {
      if (pollDue({ pending, sinceLastRunMs: Date.now() - lastRun })) auto()
    })
  }, POLL_MS)

  if (hasSession()) auto()
  else engine.markAuthRequired()
}
