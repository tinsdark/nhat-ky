/**
 * App lock with the device's own biometrics / PIN through WebAuthn (SPEC 9.4, optional). There is no
 * server, so the assertion is not verified anywhere: the lock stops someone who picks up the phone
 * and opens the app, it does not encrypt the data. The credential id is kept on this device only.
 */

export const LOCK_KEY = 'nk_lock_v1'
/** Locks again after the app has been out of sight this long. */
export const RELOCK_AFTER_MS = 2 * 60_000

export interface CredentialsApi {
  create(options: unknown): Promise<{ rawId: ArrayBuffer } | null>
  get(options: unknown): Promise<unknown | null>
}

export interface LockDeps {
  credentials: CredentialsApi
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  random: (n: number) => Uint8Array
  /** True when the device can verify the user (biometrics or screen lock). */
  available: () => Promise<boolean>
}

const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export function createLock({ credentials, storage, random, available }: LockDeps) {
  const credentialId = (): string | null => {
    try {
      return storage.getItem(LOCK_KEY)
    } catch {
      return null
    }
  }

  return {
    isEnabled: () => credentialId() !== null,
    isSupported: available,

    /** Registers a credential and turns the lock on. Resolves false if the user cancelled or it failed. */
    async enable(): Promise<boolean> {
      if (!(await available())) return false
      try {
        const cred = await credentials.create({
          publicKey: {
            challenge: random(32),
            rp: { name: 'Nhật ký' },
            user: { id: random(16), name: 'nhat-ky', displayName: 'Nhật ký' },
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 },
              { type: 'public-key', alg: -257 },
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60_000,
          },
        })
        if (!cred) return false
        storage.setItem(LOCK_KEY, toB64(cred.rawId))
        return true
      } catch {
        return false
      }
    },

    /** Asks the device to verify the user. True when unlocked (or when no lock is set). */
    async unlock(): Promise<boolean> {
      const id = credentialId()
      if (id === null) return true
      try {
        const res = await credentials.get({
          publicKey: {
            challenge: random(32),
            allowCredentials: [{ type: 'public-key', id: fromB64(id) }],
            userVerification: 'required',
            timeout: 60_000,
          },
        })
        return res !== null
      } catch {
        return false
      }
    },

    disable(): void {
      try {
        storage.removeItem(LOCK_KEY)
      } catch {
        // storage unavailable: nothing to remove
      }
    },
  }
}

/** True when the app was hidden long enough that it must be unlocked again. */
export const shouldRelock = (hiddenAt: number | null, now: number): boolean =>
  hiddenAt !== null && now - hiddenAt >= RELOCK_AFTER_MS

export type AppLock = ReturnType<typeof createLock>
