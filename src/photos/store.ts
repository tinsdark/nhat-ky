import { toIso } from '../core/date'
import { CACHE_LIMIT_BYTES, fullName, thumbName } from '../core/photo'
import type { Entry, PhotoRecord } from '../core/types'
import type { NhatKyDB } from '../data/db'

export interface PhotoDrive {
  uploadBlob(name: string, blob: Blob): Promise<string>
  downloadBlob(name: string): Promise<Blob | null>
  deleteFile(name: string): Promise<void>
}

const DELETES_KEY = 'photoDeletes'
const SWEEP_GRACE_MS = 24 * 3_600_000

/**
 * Photos live in IndexedDB first and reach Drive later through a queue of their own, so syncing
 * entries never waits for them. Drive names: `nkp_<id>.webp` (full) and `nkt_<id>.webp` (thumb).
 */
export function createPhotoStore({ db, drive }: { db: NhatKyDB; drive: PhotoDrive }) {
  let uploading: Promise<void> | null = null

  async function add(blob: Blob, thumb: Blob): Promise<string> {
    const id = crypto.randomUUID()
    await db.photos.add({ id, blob, thumb, createdAt: toIso(), uploaded: 0 })
    return id
  }

  /** Removes local copies now; the Drive files are deleted by the queue (immediately if online). */
  async function remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await db.transaction('rw', db.photos, db.meta, async () => {
      const uploaded = (await db.photos.bulkGet(ids))
        .filter((p) => p?.uploaded === 1)
        .map((p) => p!.id)
      await db.photos.bulkDelete(ids)
      if (uploaded.length > 0) {
        const pending = ((await db.meta.get(DELETES_KEY))?.value as string[] | undefined) ?? []
        await db.meta.put({ key: DELETES_KEY, value: [...new Set([...pending, ...uploaded])] })
      }
    })
  }

  /** Uploads what is waiting, then deletes what was removed. One run at a time; failures stay queued. */
  function runQueue(opts: { canUpload?: () => boolean } = {}): Promise<void> {
    uploading ??= (async () => {
      try {
        if (opts.canUpload?.() === false) return
        for (const p of await db.photos.where('uploaded').equals(0).toArray()) {
          if (!p.blob || !p.thumb) continue
          await drive.uploadBlob(thumbName(p.id), p.thumb)
          await drive.uploadBlob(fullName(p.id), p.blob)
          await db.photos.update(p.id, { uploaded: 1 })
        }
        const pending = ((await db.meta.get(DELETES_KEY))?.value as string[] | undefined) ?? []
        const left: string[] = []
        for (const id of pending) {
          try {
            await drive.deleteFile(thumbName(id))
            await drive.deleteFile(fullName(id))
          } catch {
            left.push(id)
          }
        }
        if (pending.length > 0) await db.meta.put({ key: DELETES_KEY, value: left })
      } finally {
        uploading = null
      }
    })()
    return uploading
  }

  /** Local copy, else downloaded from Drive and cached. Null when it exists nowhere. */
  async function load(id: string, kind: 'blob' | 'thumb'): Promise<Blob | null> {
    const rec = await db.photos.get(id)
    if (rec?.[kind]) return rec[kind]
    if (kind === 'blob' && rec?.trimmed) return null // the full-size file was deleted on purpose
    const file = await drive.downloadBlob(kind === 'blob' ? fullName(id) : thumbName(id))
    if (!file) return null
    if (rec) await db.photos.update(id, { [kind]: file })
    else
      await db.photos.add({
        id,
        blob: null,
        thumb: null,
        createdAt: toIso(),
        uploaded: 1,
        [kind]: file,
      } as PhotoRecord)
    if (kind === 'blob') await enforceCacheLimit()
    return file
  }

  /** Drops the oldest already-uploaded full-size files until the cache fits (thumbs stay). */
  async function enforceCacheLimit(limit = CACHE_LIMIT_BYTES): Promise<void> {
    const cached = (await db.photos.toArray()).filter((p) => p.blob)
    let total = cached.reduce((s, p) => s + p.blob!.size, 0)
    for (const p of cached
      .filter((p) => p.uploaded === 1)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (total <= limit) break
      total -= p.blob!.size
      await db.photos.update(p.id, { blob: null })
    }
  }

  /**
   * Removes photos no live entry points to, once they are older than a day (so "Hoàn tác" after a
   * delete still finds them). Covers deletes made on another device too.
   */
  async function sweepOrphans(now = Date.now()): Promise<number> {
    const used = new Set<string>()
    await db.entries.each((e: Entry) => {
      if (!e.deleted) for (const id of e.photoIds) used.add(id)
    })
    const orphans = (await db.photos.toArray())
      .filter((p) => !used.has(p.id) && now - new Date(p.createdAt).getTime() > SWEEP_GRACE_MS)
      .map((p) => p.id)
    await remove(orphans)
    return orphans.length
  }

  /**
   * "Sau 12 tháng chỉ giữ ảnh thu nhỏ": for uploaded photos older than `months`, deletes the full-size
   * file from Drive and from this device. The thumbnail stays. Returns how many photos were trimmed.
   */
  async function pruneFull(months: number, now = Date.now()): Promise<number> {
    const cutoff = now - months * 30.44 * 86_400_000
    const old = (await db.photos.toArray()).filter(
      (p) => p.uploaded === 1 && new Date(p.createdAt).getTime() < cutoff && !p.trimmed,
    )
    let trimmed = 0
    for (const p of old) {
      try {
        await drive.deleteFile(fullName(p.id))
      } catch {
        continue // offline: try again next time
      }
      await db.photos.update(p.id, { blob: null, trimmed: true })
      trimmed++
    }
    return trimmed
  }

  return { add, remove, runQueue, load, enforceCacheLimit, sweepOrphans, pruneFull }
}
