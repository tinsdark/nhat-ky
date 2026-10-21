// Per-record merge used by sync: the newer version wins, soft-deletes included.

export interface Versioned {
  updatedAt: string
  deviceId: string
}

export interface MergeResult<T> {
  merged: T[]
  /** Records where the remote version replaces (or adds to) the local one. */
  remoteWon: T[]
  /** True if the remote side lacks or has an older version of some local record. */
  localWon: boolean
}

/** > 0 if a is newer than b. Equal timestamps fall back to deviceId so every device picks the same winner. */
export function compareVersion(a: Versioned, b: Versioned): number {
  const diff = Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
  if (diff !== 0 && !Number.isNaN(diff)) return diff
  if (a.deviceId === b.deviceId) return 0
  return a.deviceId < b.deviceId ? -1 : 1
}

export function mergeRecords<T extends Versioned>(
  local: T[],
  remote: T[],
  keyOf: (record: T) => string,
): MergeResult<T> {
  const merged = new Map<string, T>()
  const remoteWon: T[] = []
  const unseen = new Map(remote.map((r) => [keyOf(r), r]))
  let localWon = false

  for (const l of local) {
    const key = keyOf(l)
    const r = unseen.get(key)
    unseen.delete(key)
    const cmp = r ? compareVersion(l, r) : 1
    if (cmp >= 0) {
      merged.set(key, l)
      if (cmp > 0) localWon = true
    } else {
      merged.set(key, r!)
      remoteWon.push(r!)
    }
  }
  for (const [key, r] of unseen) {
    merged.set(key, r)
    remoteWon.push(r)
  }
  return { merged: [...merged.values()], remoteWon, localWon }
}
