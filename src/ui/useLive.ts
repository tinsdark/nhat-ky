import { liveQuery } from 'dexie'
import { useEffect, useState } from 'preact/hooks'

/** Re-runs `query` whenever the IndexedDB tables it reads change. `undefined` until the first result. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: console.error })
    return () => sub.unsubscribe()
  }, deps)
  return value
}
