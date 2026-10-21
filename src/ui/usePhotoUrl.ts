import { useEffect, useState } from 'preact/hooks'
import { photos } from '../photos'

/** Object URL of a photo (thumb or full), loaded from IndexedDB or Drive. Undefined while loading or missing. */
export function usePhotoUrl(id: string, kind: 'thumb' | 'blob'): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let revoked = false
    let made: string | undefined
    setUrl(undefined)
    photos
      .load(id, kind)
      .then((b) => {
        if (!b || revoked) return
        made = URL.createObjectURL(b)
        setUrl(made)
      })
      .catch(() => {})
    return () => {
      revoked = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [id, kind])
  return url
}
