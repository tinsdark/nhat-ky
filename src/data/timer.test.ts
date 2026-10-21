import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addInterruption, getRunningTimer, setFocus, startTimer, stopTimer } from './timer'

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.settings.clear(), db.meta.clear()])
})

describe('timer', () => {
  it('has no timer at first and finds the one that is started', async () => {
    expect(await getRunningTimer()).toBeUndefined()
    const { entry } = await startTimer({ title: 'Code' })
    expect((await getRunningTimer())?.id).toBe(entry.id)
    expect(entry.source).toBe('timer')
    expect(entry.end).toBeNull()
  })

  it('stops the old timer when a new one starts', async () => {
    const a = await startTimer()
    const b = await startTimer()
    expect(b.stopped?.id).toBe(a.entry.id)
    expect((await db.entries.get(a.entry.id))?.end).not.toBeNull()
    expect((await getRunningTimer())?.id).toBe(b.entry.id)
    expect(await db.entries.filter((e) => e.end === null).count()).toBe(1)
  })

  it('counts interruptions and stores focus and overtime on stop', async () => {
    const { entry } = await startTimer()
    await addInterruption(entry.id)
    await addInterruption(entry.id)
    const stopped = await stopTimer(entry.id, 4)
    expect(stopped.end).not.toBeNull()
    expect(stopped.payload.interruptions).toBe(2)
    expect(stopped.payload.focus).toBe(4)
    expect(typeof stopped.payload.isOvertime).toBe('boolean')
    expect(await getRunningTimer()).toBeUndefined()
  })

  it('lets focus be set after stopping and skipped entirely', async () => {
    const { entry } = await startTimer()
    const stopped = await stopTimer(entry.id)
    expect(stopped.payload.focus).toBeUndefined()
    expect((await setFocus(entry.id, 3)).payload.focus).toBe(3)
  })
})
