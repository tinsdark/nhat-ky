import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addClaudeNote,
  deleteClaudeNote,
  getInsightStore,
  giveFeedback,
  refreshInsights,
  saveInsightStore,
} from './insights'

beforeEach(async () => {
  await Promise.all([
    db.entries.clear(),
    db.days.clear(),
    db.settings.clear(),
    db.defs.clear(),
    db.insights.clear(),
    db.meta.clear(),
  ])
})

describe('insight store', () => {
  it('runs once a day unless forced, and marks the file dirty', async () => {
    const first = await refreshInsights()
    expect(first.lastRunDate).not.toBeNull()
    const stamp = (await db.insights.get('insights'))!.updatedAt
    await refreshInsights()
    expect((await db.insights.get('insights'))!.updatedAt).toBe(stamp)
    await new Promise((r) => setTimeout(r, 5))
    await refreshInsights(true)
    expect((await db.insights.get('insights'))!.updatedAt).not.toBe(stamp)
    expect((await db.insights.get('insights'))!.dirty).toBe(1)
  })

  it('feedback changes the status of that insight only', async () => {
    const store = await getInsightStore()
    const item = (id: string) => ({
      id,
      source: 'rule' as const,
      kind: `rule:${id}`,
      text: id,
      confidence: null,
      status: 'new' as const,
      hiddenUntil: null,
      action: null,
      score: 1,
      lastSeenDate: null,
      lastShownDate: null,
      createdAt: '2026-11-01T08:00:00.000+07:00',
      updatedAt: '2026-11-01T08:00:00.000+07:00',
    })
    await saveInsightStore({ ...store, items: [item('a'), item('b')] })
    await giveFeedback('a', 'hide')
    const after = await getInsightStore()
    expect(after.items.find((i) => i.id === 'a')!.status).toBe('hidden')
    expect(after.items.find((i) => i.id === 'b')!.status).toBe('new')
  })

  it('keeps and deletes Claude notes, newest first', async () => {
    await addClaudeNote('q1', 'a1')
    await addClaudeNote('q2', 'a2')
    const notes = (await getInsightStore()).claudeNotes
    expect(notes.map((n) => n.question)).toEqual(['q2', 'q1'])
    await deleteClaudeNote(notes[0]!.id)
    expect((await getInsightStore()).claudeNotes.map((n) => n.question)).toEqual(['q1'])
  })
})
