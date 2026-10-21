import { describe, expect, it } from 'vitest'
import { createLock, LOCK_KEY, RELOCK_AFTER_MS, shouldRelock } from './lock'

function setup(over: { available?: boolean; create?: unknown; get?: unknown } = {}) {
  const data = new Map<string, string>()
  const calls: { create: unknown[]; get: unknown[] } = { create: [], get: [] }
  const lock = createLock({
    credentials: {
      create: async (o) => {
        calls.create.push(o)
        if (over.create instanceof Error) throw over.create
        return over.create === null ? null : { rawId: new Uint8Array([1, 2, 3, 250]).buffer }
      },
      get: async (o) => {
        calls.get.push(o)
        if (over.get instanceof Error) throw over.get
        return over.get === null ? null : {}
      },
    },
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    },
    random: (n) => new Uint8Array(n).fill(7),
    available: async () => over.available ?? true,
  })
  return { lock, data, calls }
}

describe('app lock', () => {
  it('is off until enabled; enabling stores the credential id on this device', async () => {
    const { lock, data } = setup()
    expect(lock.isEnabled()).toBe(false)
    expect(await lock.unlock()).toBe(true) // no lock: always open
    expect(await lock.enable()).toBe(true)
    expect(lock.isEnabled()).toBe(true)
    expect(data.get(LOCK_KEY)).toBe(btoa(String.fromCharCode(1, 2, 3, 250)))
  })
  it('asks for a platform authenticator with user verification', async () => {
    const { lock, calls } = setup()
    await lock.enable()
    const opts = (
      calls.create[0] as {
        publicKey: Record<string, unknown> & { allowCredentials: { id: Uint8Array }[] }
      }
    ).publicKey
    expect(opts.authenticatorSelection).toEqual({
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    })
    expect(opts.challenge).toHaveLength(32)
  })
  it('unlock passes the stored credential id and requires verification', async () => {
    const { lock, calls } = setup()
    await lock.enable()
    expect(await lock.unlock()).toBe(true)
    const opts = (
      calls.get[0] as {
        publicKey: Record<string, unknown> & { allowCredentials: { id: Uint8Array }[] }
      }
    ).publicKey
    expect(opts.userVerification).toBe('required')
    expect([...opts.allowCredentials[0].id]).toEqual([1, 2, 3, 250])
  })
  it('stays locked when verification is cancelled or fails', async () => {
    const a = setup({ get: new Error('NotAllowedError') })
    await a.lock.enable()
    expect(await a.lock.unlock()).toBe(false)
    const b = setup({ get: null })
    await b.lock.enable()
    expect(await b.lock.unlock()).toBe(false)
  })
  it('does not enable when the device cannot verify the user, or the user cancels', async () => {
    expect(await setup({ available: false }).lock.enable()).toBe(false)
    const cancelled = setup({ create: new Error('NotAllowedError') })
    expect(await cancelled.lock.enable()).toBe(false)
    expect(cancelled.lock.isEnabled()).toBe(false)
    expect(await setup({ create: null }).lock.enable()).toBe(false)
  })
  it('disable removes the credential', async () => {
    const { lock } = setup()
    await lock.enable()
    lock.disable()
    expect(lock.isEnabled()).toBe(false)
  })
})

describe('shouldRelock', () => {
  it('relocks after the app was hidden for 2 minutes', () => {
    expect(shouldRelock(null, 1000)).toBe(false)
    expect(shouldRelock(0, RELOCK_AFTER_MS - 1)).toBe(false)
    expect(shouldRelock(0, RELOCK_AFTER_MS)).toBe(true)
  })
})
