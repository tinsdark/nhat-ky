import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createEntry } from '../data/repository'
import { createPhotoStore, type PhotoDrive } from './store'

const blob = (n: number, type = 'image/webp') => new Blob([new Uint8Array(n)], { type })

function fakeDrive(files = new Map<string, Blob>()) {
  const log: string[] = []
  const drive: PhotoDrive = {
    async uploadBlob(name, b) {
      log.push(`up ${name}`)
      files.set(name, b)
      return name
    },
    async downloadBlob(name) {
      return files.get(name) ?? null
    },
    async deleteFile(name) {
      log.push(`del ${name}`)
      files.delete(name)
    },
  }
  return { drive, files, log }
}

beforeEach(async () => {
  await Promise.all([db.photos.clear(), db.entries.clear(), db.meta.clear(), db.settings.clear()])
})

describe('photo store', () => {
  it('keeps photos locally first, then uploads thumb and full and marks them uploaded', async () => {
    const { drive, files } = fakeDrive()
    const store = createPhotoStore({ db, drive })
    const id = await store.add(blob(1000), blob(100))
    expect((await db.photos.get(id))?.uploaded).toBe(0)
    await store.runQueue()
    expect([...files.keys()].sort()).toEqual([`nkp_${id}.webp`, `nkt_${id}.webp`])
    expect((await db.photos.get(id))?.uploaded).toBe(1)
  })

  it('does not upload when the caller says no (Wi-Fi only)', async () => {
    const { drive, log } = fakeDrive()
    const store = createPhotoStore({ db, drive })
    await store.add(blob(10), blob(5))
    await store.runQueue({ canUpload: () => false })
    expect(log).toEqual([])
  })

  it('removing an uploaded photo queues its Drive delete; a failed delete stays queued', async () => {
    const { drive, files } = fakeDrive()
    const store = createPhotoStore({ db, drive })
    const id = await store.add(blob(10), blob(5))
    await store.runQueue()
    await store.remove([id])
    expect(await db.photos.get(id)).toBeUndefined()
    const failing = {
      ...drive,
      deleteFile: async () => {
        throw new Error('offline')
      },
    }
    await createPhotoStore({ db, drive: failing }).runQueue()
    expect(files.size).toBe(2)
    await store.runQueue()
    expect(files.size).toBe(0)
  })

  it('removing a never-uploaded photo needs no Drive call', async () => {
    const { drive, log } = fakeDrive()
    const store = createPhotoStore({ db, drive })
    const id = await store.add(blob(10), blob(5))
    await store.remove([id])
    await store.runQueue()
    expect(log).toEqual([])
  })

  it('loads a missing photo from Drive and caches it', async () => {
    const { drive, files } = fakeDrive(new Map([['nkt_x.webp', blob(7)]]))
    const store = createPhotoStore({ db, drive })
    expect((await store.load('x', 'thumb'))?.size).toBe(7)
    files.delete('nkt_x.webp')
    expect((await store.load('x', 'thumb'))?.size).toBe(7) // now from IndexedDB
    expect(await store.load('nope', 'blob')).toBeNull()
  })

  it('evicts the oldest uploaded full-size files first, never un-uploaded ones', async () => {
    const { drive } = fakeDrive()
    const store = createPhotoStore({ db, drive })
    await db.photos.bulkAdd([
      {
        id: 'old',
        blob: blob(60),
        thumb: blob(1),
        createdAt: '2026-01-01T00:00:00.000+07:00',
        uploaded: 1,
      },
      {
        id: 'new',
        blob: blob(60),
        thumb: blob(1),
        createdAt: '2026-02-01T00:00:00.000+07:00',
        uploaded: 1,
      },
      {
        id: 'wait',
        blob: blob(60),
        thumb: blob(1),
        createdAt: '2025-01-01T00:00:00.000+07:00',
        uploaded: 0,
      },
    ])
    await store.enforceCacheLimit(130)
    expect((await db.photos.get('old'))?.blob).toBeNull()
    expect((await db.photos.get('new'))?.blob).not.toBeNull()
    expect((await db.photos.get('wait'))?.blob).not.toBeNull()
    expect((await db.photos.get('old'))?.thumb).not.toBeNull()
  })

  it('sweeps photos no live entry uses, after a day of grace', async () => {
    const { drive } = fakeDrive()
    const store = createPhotoStore({ db, drive })
    const kept = await store.add(blob(1), blob(1))
    const orphan = await store.add(blob(1), blob(1))
    await createEntry({ type: 'meal', start: '2026-11-02T12:00:00.000+07:00', photoIds: [kept] })
    expect(await store.sweepOrphans()).toBe(0) // too fresh
    expect(await store.sweepOrphans(Date.now() + 2 * 86_400_000)).toBe(1)
    expect(await db.photos.get(orphan)).toBeUndefined()
    expect(await db.photos.get(kept)).toBeDefined()
  })
})
