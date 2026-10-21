import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthRequiredError } from '../auth/token'
import type { Day, Entry } from '../core/types'
import { NhatKyDB } from '../data/db'
import { createSyncEngine, type SyncDrive } from './engine'

/** In-memory appDataFolder shared by every "device". */
function fakeDrive() {
  const files = new Map<string, { content: string; modifiedTime: string }>()
  let clock = 0
  const stamp = () => new Date(Date.UTC(2026, 9, 21, 0, 0, ++clock)).toISOString()
  const hooks: { afterRead?: (name: string) => Promise<void> | void; beforeWrite?: () => void } = {}
  const api = {
    reads: [] as string[],
    writes: [] as string[],
    listCalls: 0,
    files,
    hooks,
    fail: null as null | (() => Error),
    put(name: string, data: unknown) {
      files.set(name, { content: JSON.stringify(data), modifiedTime: stamp() })
    },
    json(name: string) {
      return JSON.parse(files.get(name)!.content)
    },
  }
  const guard = () => {
    if (api.fail) throw api.fail()
  }
  const drive: SyncDrive = {
    async listFiles(prefix = 'nk_') {
      guard()
      api.listCalls++
      return [...files]
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, f]) => ({ id: name, name, modifiedTime: f.modifiedTime }))
    },
    async readJson<T>(name: string) {
      guard()
      api.reads.push(name)
      const f = files.get(name)
      const value = f ? (JSON.parse(f.content) as T) : null
      await hooks.afterRead?.(name)
      return value
    },
    async getModifiedTime(name: string) {
      guard()
      return files.get(name)?.modifiedTime ?? null
    },
    async writeJson(name: string, data: unknown) {
      guard()
      hooks.beforeWrite?.()
      api.writes.push(name)
      const modifiedTime = stamp()
      files.set(name, { content: JSON.stringify(data), modifiedTime })
      return modifiedTime
    },
  }
  return Object.assign(api, { drive })
}

const entry = (
  id: string,
  dateKey: string,
  updatedAt: string,
  extra: Partial<Entry> = {},
): Entry => ({
  id,
  type: 'note',
  dateKey,
  start: `${dateKey}T09:00:00.000+07:00`,
  end: null,
  categoryId: '',
  title: id,
  value: null,
  unit: '',
  rating: null,
  tags: [],
  photoIds: [],
  payload: {},
  source: 'manual',
  note: '',
  createdAt: updatedAt,
  updatedAt,
  deviceId: 'A',
  deleted: false,
  dirty: 1,
  ...extra,
})

const day = (dateKey: string, updatedAt: string, extra: Partial<Day> = {}): Day => ({
  dateKey,
  mood: null,
  energy: null,
  stress: null,
  focus: null,
  dayScore: null,
  highlight: '',
  dayType: null,
  note: '',
  createdAt: updatedAt,
  updatedAt,
  deviceId: 'A',
  deleted: false,
  dirty: 1,
  ...extra,
})

const t = (min: number) => `2026-10-21T10:${String(min).padStart(2, '0')}:00.000+07:00`

let dbs: NhatKyDB[] = []
function device(drive: ReturnType<typeof fakeDrive>) {
  const db = new NhatKyDB(`dev-${dbs.length}-${Math.random()}`)
  dbs.push(db)
  return { db, engine: createSyncEngine({ db, drive: drive.drive }) }
}

afterEach(async () => {
  await Promise.all(dbs.map((d) => d.delete()))
  dbs = []
})

describe('entries and days', () => {
  it('pushes dirty records, clears dirty, and a second device pulls them', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    const b = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-20', t(1)))
    await a.db.days.put(day('2026-10-20', t(1), { dayScore: 8 }))
    await a.engine.run()

    expect(a.engine.getStatus().state).toBe('synced')
    expect((await a.db.entries.get('e1'))?.dirty).toBe(0)
    expect((await a.db.days.get('2026-10-20'))?.dirty).toBe(0)
    const file = drive.json('nk_2026-10.json')
    expect(file.entries).toHaveLength(1)
    expect(file.entries[0]).not.toHaveProperty('dirty')

    await b.engine.run()
    expect(await b.db.entries.get('e1')).toMatchObject({ title: 'e1', dirty: 0 })
    expect((await b.db.days.get('2026-10-20'))?.dayScore).toBe(8)
  })

  it('an edit on one device reaches the other', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    const b = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-20', t(1)))
    await a.engine.run()
    await b.engine.run()

    await b.db.entries.put(entry('e1', '2026-10-20', t(5), { title: 'edited', deviceId: 'B' }))
    await b.engine.run()
    await a.engine.run()
    expect((await a.db.entries.get('e1'))?.title).toBe('edited')
  })

  it('both devices edit the same entry: the newer wins and nothing is duplicated', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    const b = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-20', t(1)))
    await a.engine.run()
    await b.engine.run()

    await a.db.entries.put(entry('e1', '2026-10-20', t(10), { title: 'older', deviceId: 'A' }))
    await b.db.entries.put(entry('e1', '2026-10-20', t(20), { title: 'newer', deviceId: 'B' }))
    await a.engine.run()
    await b.engine.run()
    await a.engine.run()

    for (const d of [a, b]) {
      expect(await d.db.entries.count()).toBe(1)
      expect((await d.db.entries.get('e1'))?.title).toBe('newer')
    }
    expect(drive.json('nk_2026-10.json').entries).toHaveLength(1)
  })

  it('a soft delete propagates; an older delete loses to a newer edit', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    const b = device(drive)
    await a.db.entries.put(entry('gone', '2026-10-20', t(1)))
    await a.db.entries.put(entry('kept', '2026-10-20', t(1)))
    await a.engine.run()
    await b.engine.run()

    await b.db.entries.put(entry('gone', '2026-10-20', t(5), { deleted: true, deviceId: 'B' }))
    await a.db.entries.put(entry('kept', '2026-10-20', t(9), { title: 'edited', deviceId: 'A' }))
    await b.db.entries.put(entry('kept', '2026-10-20', t(3), { deleted: true, deviceId: 'B' }))
    await b.engine.run()
    await a.engine.run()
    await b.engine.run()

    expect((await a.db.entries.get('gone'))?.deleted).toBe(true)
    expect(await a.db.entries.get('kept')).toMatchObject({ deleted: false, title: 'edited' })
    expect(await b.db.entries.get('kept')).toMatchObject({ deleted: false, title: 'edited' })
  })

  it('a new device pulls every month file', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    await a.db.entries.put(entry('oct', '2026-10-20', t(1)))
    await a.db.entries.put(entry('nov', '2026-11-02', t(1)))
    await a.engine.run()
    const fresh = device(drive)
    await fresh.engine.run()
    expect(await fresh.db.entries.count()).toBe(2)
  })

  it('does not re-read files that have not changed', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-20', t(1)))
    await a.engine.run()
    drive.reads.length = 0
    drive.writes.length = 0
    await a.engine.run()
    expect(drive.reads).toEqual([])
    expect(drive.writes).toEqual([])
  })

  it('an edit made while syncing stays dirty', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-20', t(1)))
    drive.hooks.beforeWrite = () => {
      void a.db.entries.put(entry('e1', '2026-10-20', t(30), { title: 'typed during sync' }))
    }
    await a.engine.run()
    drive.hooks.beforeWrite = undefined
    expect(await a.db.entries.get('e1')).toMatchObject({ title: 'typed during sync', dirty: 1 })
    await a.engine.run()
    expect((await a.db.entries.get('e1'))?.dirty).toBe(0)
    expect(drive.json('nk_2026-10.json').entries[0].title).toBe('typed during sync')
  })

  it('merges instead of overwriting when another device writes mid-sync', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    drive.put('nk_2026-10.json', { entries: [], days: [] })
    await a.db.entries.put(entry('mine', '2026-10-20', t(1)))
    let injected = false
    drive.hooks.afterRead = () => {
      if (injected) return
      injected = true
      drive.put('nk_2026-10.json', {
        entries: [{ ...entry('theirs', '2026-10-20', t(2), { deviceId: 'B' }), dirty: undefined }],
        days: [],
      })
    }
    await a.engine.run()
    expect(a.engine.getStatus().state).toBe('synced')
    expect(
      drive
        .json('nk_2026-10.json')
        .entries.map((e: Entry) => e.id)
        .sort(),
    ).toEqual(['mine', 'theirs'])
    expect(await a.db.entries.get('theirs')).toBeDefined()
  })
})

describe('entries that change month', () => {
  it('a device that already had the entry follows it to the new month', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    const b = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-31', t(1)))
    await a.engine.run()
    await b.engine.run()

    await a.db.entries.put(entry('e1', '2026-11-01', t(9)))
    await a.engine.run()
    await b.engine.run()

    expect(await b.db.entries.count()).toBe(1)
    expect((await b.db.entries.get('e1'))?.dateKey).toBe('2026-11-01')
  })

  it('a new device ends with only the newest version', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-31', t(1)))
    await a.engine.run()
    await a.db.entries.put(entry('e1', '2026-11-01', t(9)))
    await a.engine.run()

    const fresh = device(drive)
    await fresh.engine.run()
    expect(await fresh.db.entries.count()).toBe(1)
    expect((await fresh.db.entries.get('e1'))?.dateKey).toBe('2026-11-01')
  })

  it('the stale copy is removed from the old month file the next time it is written', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-31', t(1)))
    await a.engine.run()
    await a.db.entries.put(entry('e1', '2026-11-01', t(9)))
    await a.engine.run()
    expect(drive.json('nk_2026-10.json').entries).toHaveLength(1) // stale copy still there

    await a.db.entries.put(entry('other', '2026-10-15', t(12)))
    await a.engine.run()
    expect(drive.json('nk_2026-10.json').entries.map((e: Entry) => e.id)).toEqual(['other'])
    expect(drive.json('nk_2026-11.json').entries.map((e: Entry) => e.id)).toEqual(['e1'])
  })
})

describe('defs and settings', () => {
  const settings = (updatedAt: string, dayStartHour: number, extra: object = {}) => ({
    key: 'settings' as const,
    dayStartHour,
    updatedAt,
    deviceId: 'A',
    dirty: 1 as const,
    ...extra,
  })

  it('syncs whole documents, newer wins, and strips local-only fields', async () => {
    const drive = fakeDrive()
    const a = device(drive)
    const b = device(drive)
    await a.db.settings.put(settings(t(1), 5) as never)
    await a.engine.run()
    expect(drive.json('nk_settings.json')).toEqual({
      dayStartHour: 5,
      updatedAt: t(1),
      deviceId: 'A',
    })

    await b.engine.run()
    expect((await b.db.settings.get('settings'))?.dayStartHour).toBe(5)

    await b.db.settings.put(settings(t(9), 3, { deviceId: 'B' }) as never)
    await b.engine.run()
    await a.engine.run()
    expect((await a.db.settings.get('settings'))?.dayStartHour).toBe(3)
  })

  it('an older local document does not overwrite a newer remote one', async () => {
    const drive = fakeDrive()
    drive.put('nk_defs.json', {
      categories: [],
      habits: [],
      quickActions: [],
      tags: [],
      updatedAt: t(20),
      deviceId: 'B',
    })
    const a = device(drive)
    await a.db.defs.put({
      key: 'defs',
      categories: [],
      habits: [],
      quickActions: [],
      tags: [],
      updatedAt: t(1),
      deviceId: 'A',
      dirty: 1,
    })
    await a.engine.run()
    expect((await a.db.defs.get('defs'))?.updatedAt).toBe(t(20))
    expect(drive.writes).toEqual([])
  })
})

describe('status and failures', () => {
  let drive: ReturnType<typeof fakeDrive>
  let a: ReturnType<typeof device>
  beforeEach(async () => {
    drive = fakeDrive()
    a = device(drive)
    await a.db.entries.put(entry('e1', '2026-10-20', t(1)))
  })

  it('offline: keeps local data dirty, then recovers', async () => {
    drive.fail = () => new TypeError('Failed to fetch')
    await a.engine.run()
    expect(a.engine.getStatus().state).toBe('offline')
    expect((await a.db.entries.get('e1'))?.dirty).toBe(1)

    drive.fail = null
    await a.engine.run()
    expect(a.engine.getStatus().state).toBe('synced')
    expect((await a.db.entries.get('e1'))?.dirty).toBe(0)
  })

  it('auth required: reports it, keeps data, and syncs after sign-in', async () => {
    drive.fail = () => new AuthRequiredError()
    await a.engine.run()
    expect(a.engine.getStatus().state).toBe('authRequired')
    expect((await a.db.entries.get('e1'))?.dirty).toBe(1)
    drive.fail = null
    await a.engine.run()
    expect(a.engine.getStatus().state).toBe('synced')
  })

  it('other errors are reported with their message', async () => {
    drive.fail = () => new Error('boom')
    await a.engine.run()
    expect(a.engine.getStatus()).toMatchObject({ state: 'error', error: 'boom' })
  })

  it('notifies subscribers, and markAuthRequired sets the state', async () => {
    const seen: string[] = []
    const off = a.engine.subscribe((s) => seen.push(s.state))
    await a.engine.run()
    a.engine.markAuthRequired()
    off()
    a.engine.markAuthRequired()
    expect(seen).toEqual(['syncing', 'synced', 'authRequired'])
  })

  it('never runs two syncs at once and coalesces calls made mid-run', async () => {
    let active = 0
    let maxActive = 0
    const list = drive.drive.listFiles
    drive.drive.listFiles = async (prefix) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      const files = await list(prefix)
      active--
      return files
    }
    const spy = vi.spyOn(drive.drive, 'listFiles')
    await Promise.all([a.engine.run(), a.engine.run(), a.engine.run()])
    expect(maxActive).toBe(1)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
