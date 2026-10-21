import { describe, expect, it } from 'vitest'
import { defaultDefs } from './defaults'
import {
  moveItem,
  nextOrder,
  removeQuickAction,
  setArchived,
  tagName,
  upsertById,
  validateQuickAction,
} from './defs'

const defs = defaultDefs('2026-11-01')

describe('defs helpers', () => {
  it('upsertById replaces or appends', () => {
    const list = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]
    expect(upsertById(list, { id: 'b', n: 9 })).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 9 },
    ])
    expect(upsertById(list, { id: 'c', n: 3 })).toHaveLength(3)
  })
  it('moveItem swaps order with the neighbour and stops at the ends', () => {
    const q = defs.quickActions
    const moved = moveItem(q, 'qa-lunch', -1)
    const order = (id: string) => moved.find((x) => x.id === id)!.order
    expect(order('qa-lunch')).toBe(3)
    expect(order('qa-breakfast')).toBe(4)
    expect(moveItem(q, 'qa-wake', -1)).toBe(q)
    expect(moveItem(q, 'qa-outdoor', 1)).toBe(q)
    expect(moveItem(q, 'nope', 1)).toBe(q)
  })
  it('nextOrder follows the largest order', () => {
    expect(nextOrder(defs.quickActions)).toBe(10)
    expect(nextOrder([])).toBe(1)
  })
  it('archives a category without removing it', () => {
    const cats = setArchived(defs.categories, 'cat-fun', true)
    expect(cats).toHaveLength(defs.categories.length)
    expect(cats.find((c) => c.id === 'cat-fun')!.archived).toBe(true)
  })
  it('deletes only the quick action asked for', () => {
    expect(removeQuickAction(defs, 'qa-coffee').quickActions.map((q) => q.id)).not.toContain(
      'qa-coffee',
    )
    expect(removeQuickAction(defs, 'qa-coffee').categories).toBe(defs.categories)
  })
  it('validates the category matches the action type', () => {
    const lunch = defs.quickActions.find((q) => q.id === 'qa-lunch')!
    expect(validateQuickAction(lunch, defs.categories)).toBeNull()
    expect(validateQuickAction({ ...lunch, categoryId: 'cat-deep' }, defs.categories)).toMatch(
      /cùng loại/,
    )
    expect(validateQuickAction({ ...lunch, name: ' ' }, defs.categories)).toMatch(/tên/)
  })
  it('tagName', () => {
    expect(tagName([{ id: 't1', name: 'OT', color: '' }], 't1')).toBe('OT')
    expect(tagName([], 't1')).toBeNull()
  })
})
