import { describe, expect, it } from 'vitest'
import { mergeDefs } from './mergeDefs'
import type { Defs } from './types'

const defs = (over: Partial<Defs>): Defs =>
  ({ categories: [], habits: [], quickActions: [], tags: [], ...over }) as Defs
const h = (id: string, name = id) => ({ id, name }) as never

describe('mergeDefs', () => {
  it('keeps habits that only the older file has, and the winner decides shared ones', () => {
    const winner = defs({ habits: [h('a', 'mới')] })
    const loser = defs({ habits: [h('a', 'cũ'), h('b')] })
    expect(mergeDefs(winner, loser).habits).toEqual([h('a', 'mới'), h('b')])
  })
  it('returns the winner itself when the other side adds nothing', () => {
    const winner = defs({ habits: [h('a'), h('b')] })
    expect(mergeDefs(winner, defs({ habits: [h('a')] }))).toBe(winner)
  })
  it('does not bring back quick actions or tags the winner removed', () => {
    const winner = defs({})
    const loser = defs({ quickActions: [{ id: 'q' } as never], tags: [{ id: 't' } as never] })
    const m = mergeDefs(winner, loser)
    expect(m.quickActions).toEqual([])
    expect(m.tags).toEqual([])
  })
})
