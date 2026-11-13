import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { clearErrorLog, getErrorLog, logError } from './errorLog'

beforeEach(async () => {
  await db.meta.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('error log', () => {
  it('stores errors newest first and clears', async () => {
    await logError('a', new Error('one'))
    await logError('b', new Error('two'))
    const log = await getErrorLog()
    expect(log.map((l) => [l.where, l.message])).toEqual([
      ['b', 'Error: two'],
      ['a', 'Error: one'],
    ])
    await clearErrorLog()
    expect(await getErrorLog()).toEqual([])
  })
})
