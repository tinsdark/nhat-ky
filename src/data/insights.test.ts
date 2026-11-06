import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addClaudeNote, deleteClaudeNote, getInsightStore, refreshInsights } from './insights'
import { seedDefaults } from './seed'

beforeEach(async () => {
  await Promise.all([db.insights.clear(), db.defs.clear(), db.settings.clear(), db.meta.clear()])
  await seedDefaults()
})

describe('insight store', () => {
  it('starts empty and never invents insights from no data', async () => {
    const store = await getInsightStore()
    expect(store.items).toEqual([])
    const after = await refreshInsights()
    expect(after.items).toEqual([])
    expect(after.lastRunDate).not.toBeNull()
  })

  it('runs the engines once a day unless forced', async () => {
    await refreshInsights()
    const first = await db.insights.get('insights')
    await refreshInsights()
    expect((await db.insights.get('insights'))?.updatedAt).toBe(first?.updatedAt)
    await new Promise((r) => setTimeout(r, 5))
    await refreshInsights(true)
    expect((await db.insights.get('insights'))?.updatedAt).not.toBe(first?.updatedAt)
  })

  it('adds and removes Claude notes, newest first, and marks the store dirty', async () => {
    await addClaudeNote('q1', 'a1')
    await addClaudeNote('q2', 'a2')
    let store = await getInsightStore()
    expect(store.claudeNotes.map((n) => n.question)).toEqual(['q2', 'q1'])
    expect((await db.insights.get('insights'))?.dirty).toBe(1)
    await deleteClaudeNote(store.claudeNotes[0]!.id)
    store = await getInsightStore()
    expect(store.claudeNotes.map((n) => n.question)).toEqual(['q1'])
  })
})
