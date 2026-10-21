import { hasSession } from '../auth'
import { BACKUP_PREFIX, backupDue, backupName, backupsToDelete } from '../core/backup'
import { toIso } from '../core/date'
import { deleteFile, listFiles, writeJson } from '../drive'
import { buildSnapshot } from './snapshot'

export { buildSnapshot, parseSnapshot, restoreSnapshot, SnapshotError } from './snapshot'

interface BackupDrive {
  listFiles(prefix: string): Promise<{ name: string }[]>
  writeJson(name: string, data: unknown): Promise<string>
  deleteFile(name: string): Promise<void>
}

/** Writes this Sunday's snapshot when it is missing and trims to the newest 8. True if one was written. */
export async function runBackup(
  now: number,
  drive: BackupDrive,
  snapshot: () => Promise<unknown> = buildSnapshot,
): Promise<boolean> {
  const dateKey = toIso(now).slice(0, 10) // Vietnam calendar date: the Sunday is the Sunday on the clock
  const names = (await drive.listFiles(BACKUP_PREFIX)).map((f) => f.name)
  if (!backupDue(dateKey, names)) return false
  await drive.writeJson(backupName(dateKey), await snapshot())
  for (const old of backupsToDelete([...names, backupName(dateKey)])) await drive.deleteFile(old)
  return true
}

/** Call once at app start; checks again whenever the tab becomes visible. */
export function startBackup(): void {
  const check = () => {
    if (!hasSession() || !navigator.onLine) return
    runBackup(Date.now(), { listFiles, writeJson, deleteFile }).catch((err) =>
      console.warn('backup', err),
    )
  }
  check()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}
