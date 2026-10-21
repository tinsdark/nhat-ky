import { createLock } from './lock'

export { shouldRelock } from './lock'

function store(): Storage {
  try {
    return window.localStorage
  } catch {
    // Private mode without storage: the lock simply cannot be enabled.
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage
  }
}

export const appLock = createLock({
  credentials: {
    create: (o) =>
      navigator.credentials.create(o as CredentialCreationOptions) as Promise<{
        rawId: ArrayBuffer
      } | null>,
    get: (o) => navigator.credentials.get(o as CredentialRequestOptions),
  },
  storage: store(),
  random: (n) => crypto.getRandomValues(new Uint8Array(n)),
  available: async () =>
    typeof window !== 'undefined' &&
    'PublicKeyCredential' in window &&
    (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)),
})
