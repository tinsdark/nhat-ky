import { describe, expect, it } from 'vitest'
import { mergeInsights } from './mergeInsights'
import type { Insight, InsightStore } from './types'

const insight = (id: string, status: Insight['status'], updatedAt: string) =>
  ({ id, status, updatedAt }) as Insight
const store = (p: Partial<InsightStore>): InsightStore => ({
  items: [],
  weights: {},
  lastRunDate: null,
  experiments: [],
  claudeNotes: [],
  ...p,
})

describe('mergeInsights', () => {
  it('keeps feedback given on each device', () => {
    const a = store({
      items: [insight('x', 'hidden', '2026-11-10T08:00'), insight('y', 'new', '2026-11-09T08:00')],
      weights: { a: 1 },
    })
    const b = store({
      items: [insight('x', 'new', '2026-11-09T08:00'), insight('y', 'helpful', '2026-11-10T09:00')],
      weights: { b: 1 },
    })
    const m = mergeInsights(a, b)
    expect(Object.fromEntries(m.items.map((i) => [i.id, i.status]))).toEqual({
      x: 'hidden',
      y: 'helpful',
    })
    expect(m.weights).toEqual({ a: 1 })
  })

  it('keeps experiments and notes from both sides and the latest run date', () => {
    const a = store({
      experiments: [{ id: 'e1' } as never],
      claudeNotes: [{ id: 'n1' } as never],
      lastRunDate: '2026-11-10',
    })
    const b = store({
      experiments: [{ id: 'e2' } as never],
      claudeNotes: [{ id: 'n1' } as never, { id: 'n2' } as never],
      lastRunDate: '2026-11-12',
    })
    const m = mergeInsights(a, b)
    expect(m.experiments.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(m.claudeNotes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(m.lastRunDate).toBe('2026-11-12')
  })
})
