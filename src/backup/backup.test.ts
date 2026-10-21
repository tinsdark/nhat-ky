import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createEntry, saveDay, saveDefs, softDeleteEntry, updateEntry } from '../data/repository'
import { runBackup } from './index'
import { buildSnapshot, parseSnapshot, restoreSnapshot, SnapshotError } from './snapshot'

beforeEach(async () => {
  await Promise.all([
    db.entries.clear(),
    db.days.clear(),
    db.defs.clear(),
    db.settings.clear(),
    db.insights.clear(),
    db.meta.clear(),
  ])
})

describe('snapshot round trip', () => {
  it('exports everything without local flags and restores into an empty database', async () => {
    const a = await createEntry({
      type: 'meal',
      start: '2026-11-02T12:00:00.000+07:00',
      title: 'Cơm',
    })
    const b = await createEntry({ type: 'note', start: '2026-11-02T13:00:00.000+07:00' })
    await softDeleteEntry(b.id)
    await saveDay('2026-11-02', { mood: 4 })
    await saveDefs({ categories: [], habits: [], quickActions: [], tags: [] })
    const snap = await buildSnapshot()
    expect(snap.entries).toHaveLength(2)
    expect(snap.entries.every((e) => !('dirty' in e))).toBe(true)
    expect(snap.docs.defs).toBeDefined()

    await Promise.all([db.entries.clear(), db.days.clear(), db.defs.clear()])
    const res = await restoreSnapshot(parseSnapshot(JSON.stringify(snap)))
    expect(res).toMatchObject({ entries: 2, days: 1, docs: 1 })
    expect((await db.entries.get(a.id))?.title).toBe('Cơm')
    expect((await db.entries.get(b.id))?.deleted).toBe(true)
    expect((await db.entries.get(a.id))?.dirty).toBe(1) // uploads on the next sync
  })

  it('restore never overwrites a newer local record', async () => {
    const e = await createEntry({
      type: 'meal',
      start: '2026-11-02T12:00:00.000+07:00',
      title: 'cũ',
    })
    const snap = await buildSnapshot()
    await updateEntry(e.id, { title: 'mới' })
    const res = await restoreSnapshot(snap)
    expect(res.entries).toBe(0)
    expect((await db.entries.get(e.id))?.title).toBe('mới')
  })

  it('rejects files that are not a Nhật ký backup', () => {
    expect(() => parseSnapshot('xxx')).toThrow(SnapshotError)
    expect(() => parseSnapshot('{"version":99}')).toThrow(SnapshotError)
    expect(() => parseSnapshot('[1,2]')).toThrow(SnapshotError)
  })
})

describe('runBackup', () => {
  function fakeDrive(names: string[]) {
    const files = new Set(names)
    return {
      files,
      drive: {
        listFiles: async (p: string) =>
          [...files].filter((n) => n.startsWith(p)).map((name) => ({ name })),
        writeJson: async (n: string) => (files.add(n), 'mt'),
        deleteFile: async (n: string) => void files.delete(n),
      },
    }
  }
  const sunday = new Date('2026-11-01T09:00:00+07:00').getTime()
  const monday = new Date('2026-11-02T09:00:00+07:00').getTime()
  const snap = async () => ({ ok: true })

  it('writes on Sunday only, once', async () => {
    const { files, drive } = fakeDrive([])
    expect(await runBackup(monday, drive, snap)).toBe(false)
    expect(await runBackup(sunday, drive, snap)).toBe(true)
    expect(files.has('nk_backup_2026-11-01.json')).toBe(true)
    expect(await runBackup(sunday, drive, snap)).toBe(false)
  })

  it('keeps only the newest 8', async () => {
    const old = Array.from({ length: 8 }, (_, i) => `nk_backup_2026-0${i + 1}-04.json`)
    const { files, drive } = fakeDrive([...old, 'nk_defs.json'])
    await runBackup(sunday, drive, snap)
    const backups = [...files].filter((n) => n.startsWith('nk_backup_'))
    expect(backups).toHaveLength(8)
    expect(backups).not.toContain('nk_backup_2026-01-04.json')
    expect(backups).toContain('nk_backup_2026-11-01.json')
    expect(files.has('nk_defs.json')).toBe(true)
  })

  it('uses the Vietnam date even when UTC is still the day before', async () => {
    // Sunday 2026-11-01 00:30 in Hanoi is Saturday 17:30 UTC
    const { drive, files } = fakeDrive([])
    await runBackup(new Date('2026-11-01T00:30:00+07:00').getTime(), drive, snap)
    expect(files.has('nk_backup_2026-11-01.json')).toBe(true)
  })
})

describe('importCsv', () => {
  it('imports rows, creates unknown tags, and skips duplicates on a second import', async () => {
    const { importCsv } = await import('./importCsv')
    const csv =
      'start,type,title,tags,end\n2026-11-02 12:00,meal,Cơm,ăn ngoài,\n2026-11-02 09:00,work,Code,,2026-11-02 11:00\nbad,meal,,,\n'
    const first = await importCsv(csv)
    expect(first).toMatchObject({ imported: 2, duplicates: 0, newTags: ['ăn ngoài'] })
    expect(first.errors).toHaveLength(1)
    const rows = await db.entries.toArray()
    const defs = await (await import('../data/repository')).getDefs()
    const tagId = defs.tags.find((t) => t.name === 'ăn ngoài')!.id
    expect(rows.find((r) => r.title === 'Cơm')!.tags).toEqual([tagId])
    expect(rows.find((r) => r.title === 'Code')!.payload.isOvertime).toBeUndefined() // imported as-is
    const second = await importCsv(csv)
    expect(second).toMatchObject({ imported: 0, duplicates: 2, newTags: [] })
    expect(await db.entries.count()).toBe(2)
  })
})
