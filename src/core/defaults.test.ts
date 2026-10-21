import { describe, expect, it } from 'vitest'
import { defaultDefs } from './defaults'

describe('defaultDefs', () => {
  const defs = defaultDefs('2026-11-01')

  it('has unique ids in every list', () => {
    for (const list of [defs.categories, defs.habits, defs.quickActions]) {
      const ids = list.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('a quick action with a category points at one of the same entry type, and every type has categories to pick', () => {
    for (const q of defs.quickActions) {
      if (q.categoryId) {
        const c = defs.categories.find((x) => x.id === q.categoryId)
        expect(c, q.id).toBeDefined()
        expect(c!.entryType, q.id).toBe(q.type)
      }
      expect(
        defs.categories.some((x) => x.entryType === q.type),
        q.id,
      ).toBe(true)
    }
  })

  it('has 6 sample habits with exactly 3 active', () => {
    expect(defs.habits).toHaveLength(6)
    expect(defs.habits.filter((h) => !h.archived)).toHaveLength(3)
  })

  it('returns fresh copies so callers cannot mutate the constants', () => {
    defs.categories[0]!.name = 'x'
    expect(defaultDefs('2026-11-01').categories[0]!.name).toBe('Deep work')
  })
})
