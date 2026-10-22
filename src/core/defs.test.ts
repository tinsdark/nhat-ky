import { describe, expect, it } from 'vitest'
import { defaultDefs } from './defaults'
import {
  applyDefDraft,
  ENTRY_TYPES,
  NEW_QUICK_TYPE,
  entryTypeOptions,
  moveItem,
  newCustomType,
  nextOrder,
  quickActionCategory,
  quickActionChoices,
  cleanCategoryIds,
  removeQuickAction,
  setArchived,
  tagName,
  typeLabel,
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
    const moved = moveItem(q, 'qa-work', -1)
    const order = (id: string) => moved.find((x) => x.id === id)!.order
    expect(order('qa-work')).toBe(3)
    expect(order('qa-meal')).toBe(4)
    expect(moveItem(q, 'qa-wake', -1)).toBe(q)
    expect(moveItem(q, 'qa-water', 1)).toBe(q)
    expect(moveItem(q, 'nope', 1)).toBe(q)
  })
  it('nextOrder follows the largest order', () => {
    expect(nextOrder(defs.quickActions)).toBe(8)
    expect(nextOrder([])).toBe(1)
  })
  it('archives a category without removing it', () => {
    const cats = setArchived(defs.categories, 'cat-fun', true)
    expect(cats).toHaveLength(defs.categories.length)
    expect(cats.find((c) => c.id === 'cat-fun')!.archived).toBe(true)
  })
  it('deletes only the quick action asked for', () => {
    expect(removeQuickAction(defs, 'qa-exercise').quickActions.map((q) => q.id)).not.toContain(
      'qa-exercise',
    )
    expect(removeQuickAction(defs, 'qa-exercise').categories).toBe(defs.categories)
  })
  it('validates the category matches the action type', () => {
    const lunch = { ...defs.quickActions.find((q) => q.id === 'qa-meal')!, categoryId: 'cat-lunch' }
    expect(validateQuickAction(lunch, defs.categories)).toBeNull()
    expect(validateQuickAction({ ...lunch, categoryId: 'cat-deep' }, defs.categories)).toMatch(
      /cùng loại/,
    )
    expect(validateQuickAction({ ...lunch, name: ' ' }, defs.categories)).toMatch(/tên/)
    expect(validateQuickAction({ ...lunch, categoryId: '' }, defs.categories)).toBeNull()
  })
  it('quickActionCategory keeps a matching category, drops a foreign one, gives water its own', () => {
    const cats = defs.categories
    expect(quickActionCategory('meal', 'cat-lunch', cats)).toBe('cat-lunch')
    expect(quickActionCategory('meal', 'cat-deep', cats)).toBe('')
    expect(quickActionCategory('work', '', cats)).toBe('')
    expect(quickActionCategory('water', '', cats)).toBe('cat-water')
    expect(quickActionCategory('x-new', '', cats)).toBe('')
  })
  it('quickActionChoices lists the type, narrowed to the chosen categories when there are any', () => {
    const cats = defs.categories
    const moving = cats.find((c) => c.entryType === 'activity')!
    const all = quickActionChoices({ type: 'activity' }, cats).map((c) => c.id)
    expect(all).toContain(moving.id)
    expect(all.length).toBeGreaterThan(1)
    expect(
      quickActionChoices({ type: 'activity', categoryIds: [moving.id] }, cats).map((c) => c.id),
    ).toEqual([moving.id])
    // a stale id (deleted or other type) falls back to the whole type
    expect(
      quickActionChoices({ type: 'activity', categoryIds: ['cat-deep'] }, cats).map((c) => c.id),
    ).toEqual(all)
  })
  it('cleanCategoryIds keeps own-type ids, and means "all" (undefined) for none or every one', () => {
    const cats = defs.categories
    const own = cats.filter((c) => c.entryType === 'activity' && !c.archived).map((c) => c.id)
    expect(cleanCategoryIds('activity', [own[0]!, 'cat-deep'], cats)).toEqual([own[0]])
    expect(cleanCategoryIds('activity', [], cats)).toBeUndefined()
    expect(cleanCategoryIds('activity', own, cats)).toBeUndefined()
  })
  it('study is a built-in type, offered next to the others', () => {
    expect(ENTRY_TYPES.map((t) => t.id)).toContain('study')
    expect(typeLabel(undefined, 'study')).toBe('Học tập')
    expect(entryTypeOptions(undefined).map((t) => t.id)).toContain('study')
  })
  it('tagName', () => {
    expect(tagName([{ id: 't1', name: 'OT', color: '' }], 't1')).toBe('OT')
    expect(tagName([], 't1')).toBeNull()
  })
})

describe('custom types', () => {
  it('lists built-ins first, then custom types, hiding archived ones unless asked', () => {
    const live = newCustomType(' Thuốc ', '💊')
    const hidden = { ...newCustomType('Cũ', '📌'), archived: true }
    const defs = { customTypes: [live, hidden] }
    const ids = (withArchived: boolean) => entryTypeOptions(defs, withArchived).map((t) => t.id)
    expect(ids(false)).toEqual([...ENTRY_TYPES.map((t) => t.id), live.id])
    expect(ids(true)).toContain(hidden.id)
    expect(live.name).toBe('Thuốc')
    expect(live.id.startsWith('x-')).toBe(true)
  })

  it('labels a custom type, and works on data without customTypes', () => {
    const t = newCustomType('Thuốc', '💊')
    expect(typeLabel({ customTypes: [t] }, t.id)).toBe('💊 Thuốc')
    expect(typeLabel({}, 'meal')).toBe('Ăn uống')
    expect(entryTypeOptions(undefined)).toEqual(ENTRY_TYPES)
  })
})

describe('applyDefDraft', () => {
  const base = defaultDefs('2026-11-01')
  it('rejects an empty name', () => {
    expect(applyDefDraft('tag', { id: 't1', name: '  ' }, base)).toEqual({ error: 'Nhập tên.' })
  })
  it('trims the name and adds or replaces a tag', () => {
    const r = applyDefDraft('tag', { id: 't1', name: ' ăn ngoài ', color: '#000' }, base)
    expect('defs' in r && r.defs.tags.find((t) => t.id === 't1')?.name).toBe('ăn ngoài')
  })
  it('a quick button on the "new type" option creates the type and points at it', () => {
    const r = applyDefDraft(
      'quick',
      { id: 'q9', name: 'Thiền', icon: '🧘', type: NEW_QUICK_TYPE, categoryId: '' },
      base,
    )
    if (!('defs' in r)) throw new Error(r.error)
    const created = r.defs.customTypes?.find((t) => t.name === 'Thiền')
    expect(created?.id).toMatch(/^x-/)
    expect(r.defs.quickActions.find((q) => q.id === 'q9')?.type).toBe(created?.id)
  })
  it('only a water button keeps its value and unit', () => {
    const quick = (type: string) =>
      applyDefDraft(
        'quick',
        { id: 'q1', name: 'Nước', type, value: '250', unit: 'ml', categoryId: '' },
        base,
      )
    const water = quick('water')
    const work = quick('work')
    expect('defs' in water && water.defs.quickActions.find((q) => q.id === 'q1')).toMatchObject({
      value: 250,
      unit: 'ml',
    })
    expect('defs' in work && work.defs.quickActions.find((q) => q.id === 'q1')).toMatchObject({
      value: null,
      unit: '',
    })
  })
  it('refuses a number that is not a number', () => {
    expect(
      applyDefDraft(
        'quick',
        { id: 'q1', name: 'Nước', type: 'water', value: 'abc', categoryId: '' },
        base,
      ),
    ).toEqual({ error: 'Giá trị không hợp lệ.' })
  })
})
