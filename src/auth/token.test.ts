import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthNetworkError,
  AuthRequiredError,
  SIGNED_IN_FLAG,
  createAuth,
  type TokenRequester,
} from './token'

let t = 0
const now = () => t

function setup(request: TokenRequester) {
  const store = new Map<string, string>()
  const setItem = vi.fn((k: string, v: string) => void store.set(k, v))
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem,
    removeItem: (k: string) => void store.delete(k),
  }
  const revoke = vi.fn(async () => {})
  return { auth: createAuth({ request, storage, revoke, now }), store, setItem, revoke }
}

const ok = (n: number, expiresInSec = 3600) => ({ accessToken: `tok${n}`, expiresInSec })

beforeEach(() => {
  t = 1_000_000
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('getToken', () => {
  it('reuses a fresh token', async () => {
    const request = vi.fn(async () => ok(1))
    const { auth } = setup(request)
    expect(await auth.getToken()).toBe('tok1')
    t += 30 * 60_000
    expect(await auth.getToken()).toBe('tok1')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('refreshes silently when less than 60s is left', async () => {
    let n = 0
    const request = vi.fn(async () => ok(++n))
    const { auth } = setup(request)
    await auth.getToken()
    t += 3600_000 - 59_000
    expect(await auth.getToken()).toBe('tok2')
    expect(request).toHaveBeenLastCalledWith({ prompt: '' })
  })

  it('shares one request between concurrent callers', async () => {
    const request = vi.fn(async () => ok(1))
    const { auth } = setup(request)
    const all = await Promise.all([1, 2, 3, 4, 5].map(() => auth.getToken()))
    expect(new Set(all)).toEqual(new Set(['tok1']))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('invalidateToken forces a new request', async () => {
    let n = 0
    const request = vi.fn(async () => ok(++n))
    const { auth } = setup(request)
    await auth.getToken()
    auth.invalidateToken()
    expect(await auth.getToken()).toBe('tok2')
  })
})

describe('failures', () => {
  it('silent failure notifies onAuthRequired once and rejects', async () => {
    const request = vi.fn(async () => {
      throw new AuthRequiredError('interaction_required')
    })
    const { auth } = setup(request)
    const cb = vi.fn()
    auth.onAuthRequired(cb)
    await expect(auth.getToken()).rejects.toBeInstanceOf(AuthRequiredError)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('network failure does not ask for sign-in', async () => {
    const request = vi.fn(async () => {
      throw new AuthNetworkError()
    })
    const { auth } = setup(request)
    const cb = vi.fn()
    auth.onAuthRequired(cb)
    await expect(auth.getToken()).rejects.toBeInstanceOf(AuthNetworkError)
    expect(cb).not.toHaveBeenCalled()
  })

  it('a hung silent request times out as auth required', async () => {
    const { auth } = setup(() => new Promise(() => {}))
    const cb = vi.fn()
    auth.onAuthRequired(cb)
    const p = auth.getToken()
    const assertion = expect(p).rejects.toBeInstanceOf(AuthRequiredError)
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('recovers after a failure', async () => {
    const request = vi
      .fn<TokenRequester>()
      .mockRejectedValueOnce(new AuthRequiredError())
      .mockResolvedValueOnce(ok(2))
    const { auth } = setup(request)
    await expect(auth.getToken()).rejects.toThrow()
    expect(await auth.getToken()).toBe('tok2')
  })

  it('unsubscribe stops notifications', async () => {
    const { auth } = setup(async () => {
      throw new AuthRequiredError()
    })
    const cb = vi.fn()
    const off = auth.onAuthRequired(cb)
    off()
    await expect(auth.getToken()).rejects.toThrow()
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('sign-in / restore / sign-out', () => {
  it('signIn is interactive and sets the flag', async () => {
    const request = vi.fn(async () => ok(1))
    const { auth, store } = setup(request)
    await auth.signIn()
    expect(request).toHaveBeenCalledWith({ prompt: 'select_account' })
    expect(store.get(SIGNED_IN_FLAG)).toBe('1')
    expect(auth.isSignedIn()).toBe(true)
  })

  it('restoreSession does nothing without the flag', async () => {
    const request = vi.fn(async () => ok(1))
    const { auth } = setup(request)
    expect(await auth.restoreSession()).toBe(false)
    expect(request).not.toHaveBeenCalled()
  })

  it('restoreSession asks silently when the flag is set', async () => {
    const request = vi.fn(async () => ok(1))
    const { auth, store } = setup(request)
    store.set(SIGNED_IN_FLAG, '1')
    expect(await auth.restoreSession()).toBe(true)
    expect(request).toHaveBeenCalledWith({ prompt: '' })
  })

  it('restoreSession returns false when Google needs interaction', async () => {
    const { auth, store } = setup(async () => {
      throw new AuthRequiredError()
    })
    store.set(SIGNED_IN_FLAG, '1')
    expect(await auth.restoreSession()).toBe(false)
  })

  it('signOut revokes, clears the flag and the token', async () => {
    const { auth, store, revoke } = setup(async () => ok(1))
    await auth.signIn()
    await auth.signOut()
    expect(revoke).toHaveBeenCalledWith('tok1')
    expect(store.has(SIGNED_IN_FLAG)).toBe(false)
    expect(auth.isSignedIn()).toBe(false)
  })
})

describe('storage', () => {
  it('never writes the token to storage', async () => {
    const { auth, setItem } = setup(async () => ok(1))
    await auth.signIn()
    await auth.getToken()
    for (const [key, value] of setItem.mock.calls) {
      expect(key).toBe(SIGNED_IN_FLAG)
      expect(value).toBe('1')
    }
  })

  it('works when storage throws', async () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const auth = createAuth({ request: async () => ok(1), storage, now })
    expect(await auth.restoreSession()).toBe(false)
    expect(await auth.signIn()).toBe('tok1')
  })
})
