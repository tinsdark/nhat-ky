import { registerSW } from 'virtual:pwa-register'

export type UpdateState = 'idle' | 'checking' | 'available' | 'latest' | 'unsupported'

let registration: ServiceWorkerRegistration | undefined
let state: UpdateState = 'idle'
const listeners = new Set<(s: UpdateState) => void>()

function set(next: UpdateState) {
  state = next
  listeners.forEach((l) => l(next))
}

// 'prompt' mode: a new version waits until the user presses the button in Cài đặt → Ứng dụng.
const reload = registerSW({
  onNeedRefresh: () => set('available'),
  onRegisteredSW: (_url, reg) => {
    registration = reg
  },
})

export const getUpdateState = () => state

export function subscribeUpdate(fn: (s: UpdateState) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Asks the browser to look for a new version; resolves once the answer is known (10 s at most). */
export async function checkForUpdate(): Promise<void> {
  if (state === 'available') return
  if (!registration) return set('unsupported')
  set('checking')
  try {
    await registration.update()
  } catch {
    return set('latest') // offline: nothing newer is known
  }
  const worker = registration.waiting ?? registration.installing
  if (!worker) return set('latest')
  if (worker.state === 'installed') return set('available')
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    worker.addEventListener('statechange', () => worker.state === 'installed' && done())
    setTimeout(done, 10_000)
  })
  set(getUpdateState() === 'available' || registration.waiting ? 'available' : 'latest')
}

/**
 * Activates the waiting version and reloads the page. A page the worker does not control yet (first
 * visit) never gets the "controlling" signal, so reload by hand if nothing happened.
 */
export function applyUpdate(): void {
  void reload(true)
  setTimeout(() => location.reload(), 3000)
}
