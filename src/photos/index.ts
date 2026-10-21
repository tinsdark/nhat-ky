import { downloadBlob, deleteFile, uploadBlob } from '../drive'
import { hasSession } from '../auth'
import { db } from '../data/db'
import { getSettings } from '../data/repository'
import { createPhotoStore } from './store'

export { PhotoError, processPhoto } from './process'

export const photos = createPhotoStore({ db, drive: { uploadBlob, downloadBlob, deleteFile } })

/** `navigator.connection` is missing on iOS, so "unknown" counts as allowed. */
function onWifiOrUnknown(): boolean {
  const type = (navigator as { connection?: { type?: string } }).connection?.type
  return type === undefined || type === 'wifi' || type === 'ethernet'
}

async function runQueue(): Promise<void> {
  if (!hasSession() || !navigator.onLine) return
  const { photosWifiOnly } = await getSettings()
  try {
    await photos.runQueue({ canUpload: () => !photosWifiOnly || onWifiOrUnknown() })
  } catch (err) {
    console.warn('photo queue', err) // stays queued; the next trigger retries
  }
}

export const pokePhotoQueue = () => void runQueue()

/** Call once at app start: sweep orphans, then upload on open, tab visible, back online, every 2 minutes. */
export function startPhotoQueue(): void {
  void photos.sweepOrphans().then(runQueue)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pokePhotoQueue()
  })
  window.addEventListener('online', pokePhotoQueue)
  setInterval(() => {
    if (document.visibilityState === 'visible') pokePhotoQueue()
  }, 120_000)
}
