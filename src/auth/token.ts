// Token lifecycle, independent of Google Identity Services so it can be unit-tested.
// The access token lives only in memory; the only thing persisted is a "signed in before" flag.

export class AuthRequiredError extends Error {
  constructor(reason = 'auth required') {
    super(reason)
    this.name = 'AuthRequiredError'
  }
}

/** Could not reach Google (offline, script blocked). Not a sign-in problem. */
export class AuthNetworkError extends Error {
  constructor(reason = 'network error') {
    super(reason)
    this.name = 'AuthNetworkError'
  }
}

export interface TokenResponse {
  accessToken: string
  expiresInSec: number
}

/** Rejects with AuthRequiredError when the user must interact, AuthNetworkError when Google is unreachable. */
export type TokenRequester = (opts: { prompt: '' | 'select_account' }) => Promise<TokenResponse>

export const SIGNED_IN_FLAG = 'nk_signedIn'
export const REFRESH_MARGIN_MS = 60_000
export const SILENT_TIMEOUT_MS = 15_000

export interface AuthDeps {
  request: TokenRequester
  revoke?: (token: string) => Promise<void>
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  now?: () => number
}

export function createAuth({ request, revoke, storage, now = Date.now }: AuthDeps) {
  let token: string | null = null
  let expiresAt = 0
  let pending: Promise<string> | null = null
  const listeners = new Set<() => void>()

  const flag = {
    get: () => safe(() => storage?.getItem(SIGNED_IN_FLAG)) === '1',
    set: () => safe(() => storage?.setItem(SIGNED_IN_FLAG, '1')),
    clear: () => safe(() => storage?.removeItem(SIGNED_IN_FLAG)),
  }

  const isFresh = () => token !== null && now() < expiresAt - REFRESH_MARGIN_MS

  function refresh(interactive: boolean): Promise<string> {
    if (pending) return pending
    const req = request({ prompt: interactive ? 'select_account' : '' })
    // A silent request can hang forever (third-party cookies blocked); don't let it block every caller.
    const guarded = interactive
      ? req
      : Promise.race([
          req,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new AuthRequiredError('silent request timed out')),
              SILENT_TIMEOUT_MS,
            ),
          ),
        ])
    const p: Promise<string> = guarded
      .then((res) => {
        token = res.accessToken
        expiresAt = now() + res.expiresInSec * 1000
        flag.set()
        return token
      })
      .catch((err) => {
        token = null
        if (err instanceof AuthRequiredError) listeners.forEach((cb) => cb())
        throw err
      })
      .finally(() => {
        if (pending === p) pending = null
      })
    pending = p
    return p
  }

  return {
    /** Valid access token; refreshes silently when missing or about to expire. */
    getToken: (): Promise<string> => (isFresh() ? Promise.resolve(token!) : refresh(false)),

    /** For user-gesture sign-in (shows Google's account chooser). */
    signIn: (): Promise<string> => refresh(true),

    /** Drop the cached token, e.g. after Drive answers 401. The next getToken() asks for a new one. */
    invalidateToken(): void {
      token = null
      expiresAt = 0
    },

    /** On app start: silently get a token if the user has signed in before. */
    async restoreSession(): Promise<boolean> {
      if (!flag.get()) return false
      try {
        await refresh(false)
        return true
      } catch {
        return false
      }
    },

    async signOut(): Promise<void> {
      const old = token
      token = null
      expiresAt = 0
      flag.clear()
      if (old && revoke) await revoke(old).catch(() => {})
    },

    isSignedIn: isFresh,

    /** Called when silent refresh fails and the UI must show "Đăng nhập lại". Returns an unsubscribe. */
    onAuthRequired(cb: () => void): () => void {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}
