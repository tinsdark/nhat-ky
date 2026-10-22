// Sync engine: IndexedDB <-> Drive appDataFolder. Month files nk_YYYY-MM.json hold { entries, days };
// nk_defs.json / nk_settings.json sync as whole documents. Merging is per record, newest updatedAt wins.
import type { Table } from 'dexie'
import { AuthNetworkError, AuthRequiredError } from '../auth/token'
import { toIso } from '../core/date'
import { compareVersion, mergeRecords, type Versioned } from '../core/merge'
import { mergeDefs } from '../core/mergeDefs'
import { isDay, isDocStamp, isEntry } from '../core/validate'
import type { Day, Defs, Entry } from '../core/types'
import type { DocStamp, NhatKyDB } from '../data/db'
import { DriveError, type DriveClient } from '../drive/client'

export type SyncDrive = Pick<
  DriveClient,
  'listFiles' | 'readJson' | 'writeJson' | 'getModifiedTime'
>

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'authRequired' | 'error'

export interface SyncStatus {
  state: SyncState
  lastSyncAt: string | null
  error: string | null
}

export interface SyncEngine {
  /** Runs one sync; calls arriving mid-run are coalesced into one follow-up run. */
  run(): Promise<void>
  getStatus(): SyncStatus
  subscribe(cb: (status: SyncStatus) => void): () => void
  /** For when the token is gone: UI shows the sign-in button until the next successful run. */
  markAuthRequired(): void
}

interface MonthFile {
  entries?: Entry[]
  days?: Day[]
}

type DocRecord = DocStamp & { key: string }

const MONTH_FILE = /^nk_(\d{4}-\d{2})\.json$/
const MAX_CONFLICT_RETRIES = 3
const DEFS_FILE = 'nk_defs.json'

const monthOf = (dateKey: string) => dateKey.slice(0, 7)
const monthFileName = (month: string) => `nk_${month}.json`

/** Copy without local-only fields. */
function strip(record: object, ...keys: string[]): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...record }
  for (const k of keys) delete copy[k]
  return copy
}

export function createSyncEngine({ db, drive }: { db: NhatKyDB; drive: SyncDrive }): SyncEngine {
  let status: SyncStatus = { state: 'idle', lastSyncAt: null, error: null }
  const listeners = new Set<(s: SyncStatus) => void>()
  let running: Promise<void> | null = null
  let again = false

  function setStatus(patch: Partial<SyncStatus>) {
    status = { ...status, ...patch }
    listeners.forEach((cb) => cb(status))
  }

  const mtKey = (name: string) => `mt:${name}`
  const getMt = async (name: string) => ((await db.meta.get(mtKey(name)))?.value as string) ?? null
  const setMt = (name: string, mt: string) => db.meta.put({ key: mtKey(name), value: mt })

  async function syncMonth(month: string, listedMt: string | null, attempt = 0): Promise<void> {
    const name = monthFileName(month)
    const remote: MonthFile = listedMt ? ((await drive.readJson<MonthFile>(name)) ?? {}) : {}
    const lo = `${month}-00`
    const hi = `${month}-99`
    const localEntries = await db.entries.where('dateKey').between(lo, hi, true, true).toArray()
    const localDays = await db.days.where('dateKey').between(lo, hi, true, true).toArray()

    // An entry edited into another month leaves a stale copy here; drop it instead of letting it win.
    let droppedStale = false
    const remoteEntries: Entry[] = []
    const validRemote = (remote.entries ?? []).filter((x) => isEntry(x))
    const locals = await db.entries.bulkGet(validRemote.map((r) => r.id))
    for (const [i, r] of validRemote.entries()) {
      const l = locals[i]
      if (l && monthOf(l.dateKey) !== month && compareVersion(l, r) >= 0) {
        droppedStale = true
        continue
      }
      remoteEntries.push({ ...r, dirty: 0 })
    }
    const remoteDays = (remote.days ?? [])
      .filter((x) => isDay(x))
      .map((d) => ({ ...d, dirty: 0 as const }))

    const e = mergeRecords(localEntries, remoteEntries, (x) => x.id)
    const d = mergeRecords(localDays, remoteDays, (x) => x.dateKey)

    // Re-check inside the transaction: the user may have edited while we were on the network.
    await db.transaction('rw', db.entries, db.days, async () => {
      for (const r of e.remoteWon) {
        const cur = await db.entries.get(r.id)
        if (!cur || compareVersion(r, cur) > 0) await db.entries.put(r)
      }
      for (const r of d.remoteWon) {
        const cur = await db.days.get(r.dateKey)
        if (!cur || compareVersion(r, cur) > 0) await db.days.put(r)
      }
    })

    if (!(e.localWon || d.localWon || droppedStale)) {
      if (listedMt) await setMt(name, listedMt)
      return
    }

    // Someone else wrote since we listed: merge again instead of overwriting their changes.
    const current = await drive.getModifiedTime(name)
    if (current !== listedMt) {
      if (attempt >= MAX_CONFLICT_RETRIES) throw new Error(`Sync conflict on ${name}`)
      return syncMonth(month, current, attempt + 1)
    }

    const mt = await drive.writeJson(name, {
      entries: e.merged.map((r) => strip(r, 'dirty')),
      days: d.merged.map((r) => strip(r, 'dirty')),
    })
    // Only clear dirty if the record is still the version we pushed.
    await db.transaction('rw', db.entries, db.days, db.meta, async () => {
      for (const r of e.merged) {
        const cur = await db.entries.get(r.id)
        if (cur?.dirty === 1 && compareVersion(cur, r) === 0)
          await db.entries.update(r.id, { dirty: 0 })
      }
      for (const r of d.merged) {
        const cur = await db.days.get(r.dateKey)
        if (cur?.dirty === 1 && compareVersion(cur, r) === 0)
          await db.days.update(r.dateKey, { dirty: 0 })
      }
      await setMt(name, mt)
    })
  }

  async function syncDoc<T extends DocRecord>(
    name: string,
    table: Table<T, string>,
    key: string,
    listedMt: string | null,
    attempt = 0,
  ): Promise<void> {
    let local = await table.get(key)
    if (local?.dirty !== 1 && (listedMt === null || listedMt === (await getMt(name)))) return

    const remote = listedMt ? await drive.readJson<Versioned & Record<string, unknown>>(name) : null

    if (remote && !isDocStamp(remote)) {
      console.warn(`Ignoring ${name} on Drive: invalid stamp`)
      return
    }
    // This device has never synced the file, so any local row is the seed (or an edit made on top of it
    // before sign-in): the copy on Drive is the real one and must not be overwritten by it.
    const firstSync = remote !== null && (await getMt(name)) === null

    // Both sides changed defs: keep what only the losing side added, then push the union as a new version.
    if (name === DEFS_FILE && remote && local?.dirty === 1 && !firstSync) {
      const remoteWins = compareVersion(remote, local) > 0
      const winner = (remoteWins ? remote : local) as unknown as Defs
      const merged = mergeDefs(winner, (remoteWins ? local : remote) as unknown as Defs)
      if (merged !== winner) {
        local = {
          ...merged,
          key,
          updatedAt: toIso(),
          deviceId: local.deviceId,
          dirty: 1,
        } as unknown as typeof local
        await table.put(local as T)
      }
    }

    if (remote && (firstSync || !local || compareVersion(remote, local) > 0)) {
      const cur = await table.get(key)
      if (
        !cur ||
        (firstSync ? cur.updatedAt === local?.updatedAt : compareVersion(remote, cur) > 0)
      ) {
        await table.put({ ...remote, key, dirty: 0 } as unknown as T)
      }
      await setMt(name, listedMt!)
      return
    }

    if (local && (!remote || compareVersion(local, remote) > 0)) {
      const current = await drive.getModifiedTime(name)
      if (current !== listedMt) {
        if (attempt >= MAX_CONFLICT_RETRIES) throw new Error(`Sync conflict on ${name}`)
        return syncDoc(name, table, key, current, attempt + 1)
      }
      const mt = await drive.writeJson(name, strip(local, 'key', 'dirty'))
      await db.transaction('rw', table, db.meta, async () => {
        const cur = await table.get(key)
        if (cur?.dirty === 1 && compareVersion(cur, local) === 0) {
          await table.update(key, { dirty: 0 } as never)
        }
        await setMt(name, mt)
      })
      return
    }

    // Same version on both sides.
    if (local?.dirty === 1) await table.update(key, { dirty: 0 } as never)
    if (listedMt) await setMt(name, listedMt)
  }

  async function syncAll(): Promise<void> {
    const remoteFiles = new Map<string, string>() // name -> newest modifiedTime
    for (const f of await drive.listFiles('nk_')) {
      const known = remoteFiles.get(f.name)
      if (!known || f.modifiedTime > known) remoteFiles.set(f.name, f.modifiedTime)
    }

    const months = new Set<string>()
    for (const [name, mt] of remoteFiles) {
      const month = MONTH_FILE.exec(name)?.[1]
      if (month && mt !== (await getMt(name))) months.add(month)
    }
    for (const e of await db.entries.where('dirty').equals(1).toArray())
      months.add(monthOf(e.dateKey))
    for (const d of await db.days.where('dirty').equals(1).toArray()) months.add(monthOf(d.dateKey))

    for (const month of [...months].sort()) {
      await syncMonth(month, remoteFiles.get(monthFileName(month)) ?? null)
    }
    await syncDoc(DEFS_FILE, db.defs, 'defs', remoteFiles.get('nk_defs.json') ?? null)
    await syncDoc(
      'nk_settings.json',
      db.settings,
      'settings',
      remoteFiles.get('nk_settings.json') ?? null,
    )
    await syncDoc(
      'nk_insights.json',
      db.insights,
      'insights',
      remoteFiles.get('nk_insights.json') ?? null,
    )
  }

  async function once(): Promise<boolean> {
    setStatus({ state: 'syncing', error: null })
    try {
      await syncAll()
      setStatus({ state: 'synced', lastSyncAt: toIso() })
      return true
    } catch (err) {
      // A second 401 after the silent refresh means the user must sign in again.
      if (err instanceof AuthRequiredError || (err instanceof DriveError && err.status === 401))
        setStatus({ state: 'authRequired' })
      else if (
        err instanceof AuthNetworkError ||
        (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) ||
        (typeof navigator !== 'undefined' && navigator.onLine === false)
      ) {
        setStatus({ state: 'offline' })
      } else {
        setStatus({ state: 'error', error: err instanceof Error ? err.message : String(err) })
      }
      return false
    }
  }

  return {
    run() {
      if (running) {
        again = true
        return running
      }
      running = (async () => {
        do {
          again = false
          if (!(await once())) break
        } while (again)
      })().finally(() => {
        running = null
      })
      return running
    },
    getStatus: () => status,
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    markAuthRequired: () => setStatus({ state: 'authRequired' }),
  }
}
