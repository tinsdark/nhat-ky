import { logError } from './errorLog'

export interface StorageStatus {
  /** null when the browser cannot tell (no StorageManager). */
  persisted: boolean | null
  usedBytes: number | null
  quotaBytes: number | null
}

/**
 * Asks the browser not to evict this app's IndexedDB under storage pressure. Data not yet on Drive
 * (offline, or "đăng nhập sau") exists only here, so losing it would be final.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch (err) {
    void logError('storage.persist', err)
    return null
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    const s = navigator.storage
    if (!s?.persisted) return { persisted: null, usedBytes: null, quotaBytes: null }
    const [persisted, est] = await Promise.all([
      s.persisted(),
      s.estimate?.() ?? Promise.resolve({}),
    ])
    return {
      persisted,
      usedBytes: (est as StorageEstimate).usage ?? null,
      quotaBytes: (est as StorageEstimate).quota ?? null,
    }
  } catch {
    return { persisted: null, usedBytes: null, quotaBytes: null }
  }
}
