import { liveQuery } from 'dexie'
import { useEffect, useState } from 'preact/hooks'

/** Fired when a query fails, so App can say so instead of leaving a screen blank for ever. */
export const DATA_ERROR_EVENT = 'nk-data-error'

/** Re-runs `query` whenever the IndexedDB tables it reads change. `undefined` until the first result. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: setValue,
      error: (err) => {
        console.error(err)
        window.dispatchEvent(new Event(DATA_ERROR_EVENT))
      },
    })
    return () => sub.unsubscribe()
  }, deps)
  return value
}
