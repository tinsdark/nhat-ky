import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseSnapshot, restoreSnapshot } from '../backup/snapshot'
import { db } from './db'
import { executePurge, planPurge } from './purge'
import { createEntry, getEntriesInRange, saveDay } from './repository'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const at = (day: string) => `${day}T12:00:00.000+07:00`

async function seed() {
  const a = await createEntry({ type: 'meal', start: at('2026-10-05'), title: 'cũ', note: 'n' })
  const b = await createEntry({
    type: 'meal',
    start: at('2026-10-10'),
    title: 'giữa',
    photoIds: ['shared', 'only-b'],
  })
  const c = await createEntry({
    type: 'meal',
    start: at('2026-10-20'),
    title: 'mới',
    photoIds: ['shared'],
  })
  await saveDay('2026-10-05', { mood: 4 })
  await saveDay('2026-10-20', { mood: 2 })
  return { a, b, c }
}

describe('planPurge / executePurge', () => {
  it('deletes entries and day ratings in the range, ends included, and nothing else', async () => {
    const { a, b, c } = await seed()
    const plan = await planPurge({ from: '2026-10-05', to: '2026-10-10' })
    expect(plan.entryIds.sort()).toEqual([a.id, b.id].sort())
    expect(plan.dayKeys).toEqual(['2026-10-05'])
    const removePhotos = vi.fn(async () => {})
    expect(await executePurge(plan, removePhotos)).toEqual({ entries: 2, days: 1, photos: 1 })
    expect((await getEntriesInRange('2000-01-01', '2100-01-01')).map((e) => e.id)).toEqual([c.id])
    const gone = await db.entries.get(a.id)
    expect(gone).toMatchObject({ deleted: true, title: '', note: '', dirty: 1 })
    expect(await db.days.get('2026-10-20')).toMatchObject({ deleted: false, mood: 2 })
    expect(await db.days.get('2026-10-05')).toMatchObject({ deleted: true, mood: null })
  })

  it('an empty start date deletes everything up to the end date', async () => {
    await seed()
    const plan = await planPurge({ from: null, to: '2026-10-10' })
    expect(plan.entryIds).toHaveLength(2)
  })

  it('removes only the photos no surviving entry uses', async () => {
    await seed()
    const plan = await planPurge({ from: '2026-10-10', to: '2026-10-10' })
    expect(plan.photoIds).toEqual(['only-b']) // 'shared' is still on the entry of 20/10
    const removePhotos = vi.fn(async () => {})
    await executePurge(plan, removePhotos)
    expect(removePhotos).toHaveBeenCalledWith(['only-b'])
  })

  it('planning changes nothing', async () => {
    await seed()
    await planPurge({ from: null, to: '2026-10-22' })
    expect((await db.entries.filter((e) => e.deleted).toArray()).length).toBe(0)
  })

  it('the backup file restores the deleted records', async () => {
    const { a } = await seed()
    const plan = await planPurge({ from: null, to: '2026-10-10' })
    const backup = JSON.stringify(plan.backup)
    await executePurge(plan, async () => {})
    expect((await db.entries.get(a.id))?.deleted).toBe(true)
    const res = await restoreSnapshot(parseSnapshot(backup))
    expect(res).toMatchObject({ entries: 2, days: 1 })
    expect(await db.entries.get(a.id)).toMatchObject({ deleted: false, title: 'cũ', note: 'n' })
    expect(await db.days.get('2026-10-05')).toMatchObject({ deleted: false, mood: 4 })
  })

  it('a record deleted between plan and execute is skipped, not counted', async () => {
    const { a } = await seed()
    const plan = await planPurge({ from: null, to: '2026-10-05' })
    await executePurge(plan, async () => {})
    const again = await executePurge(plan, async () => {})
    expect(again).toMatchObject({ entries: 0, days: 0 })
    expect((await db.entries.get(a.id))?.deleted).toBe(true)
  })
})
