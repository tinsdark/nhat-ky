import type { Category, CustomType, Defs, EntryType, QuickAction, Tag } from './types'

export const ENTRY_TYPES: { id: EntryType; label: string }[] = [
  { id: 'sleep', label: 'Ngủ' },
  { id: 'meal', label: 'Ăn uống' },
  { id: 'work', label: 'Làm việc' },
  { id: 'study', label: 'Học tập' },
  { id: 'activity', label: 'Hoạt động' },
  { id: 'exercise', label: 'Vận động' },
  { id: 'water', label: 'Uống nước' },
  { id: 'note', label: 'Check-in / ghi chú' },
]

/** Built-in types plus the user's own (archived ones only when `withArchived`), for the "Loại" selects. */
export function entryTypeOptions(
  defs: Pick<Defs, 'customTypes'> | null | undefined,
  withArchived = false,
): { id: EntryType; label: string }[] {
  const custom = (defs?.customTypes ?? [])
    .filter((t) => withArchived || !t.archived)
    .map((t) => ({ id: t.id as EntryType, label: `${t.icon} ${t.name}`.trim() }))
  return [...ENTRY_TYPES, ...custom]
}

export const typeLabel = (defs: Pick<Defs, 'customTypes'> | null | undefined, t: EntryType) =>
  entryTypeOptions(defs, true).find((x) => x.id === t)?.label ?? t

export const newCustomType = (name: string, icon: string): CustomType => ({
  id: `x-${crypto.randomUUID().slice(0, 8)}`,
  name: name.trim(),
  icon,
  archived: false,
})

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

export const nextOrder = (list: { order: number }[]) =>
  list.reduce((m, x) => Math.max(m, x.order), 0) + 1

/** Replaces the item with the same id, or appends it. */
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item]
}

/** Swaps `order` with the neighbour above (`-1`) or below (`1`); a no-op at the ends. */
export function moveItem<T extends { id: string; order: number }>(
  list: T[],
  id: string,
  dir: -1 | 1,
): T[] {
  const sorted = [...list].sort((a, b) => a.order - b.order)
  const i = sorted.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return list
  const a = sorted[i]!
  const b = sorted[j]!
  return list.map((x) =>
    x.id === a.id ? { ...x, order: b.order } : x.id === b.id ? { ...x, order: a.order } : x,
  )
}

/**
 * Categories with data are never deleted (old statistics would lose their names), only archived.
 * Quick actions may be deleted: they are templates, entries keep their own copy of the fields.
 */
export const setArchived = (list: Category[], id: string, archived: boolean): Category[] =>
  list.map((c) => (c.id === id ? { ...c, archived } : c))

export const removeQuickAction = (defs: Defs, id: string): Defs => ({
  ...defs,
  quickActions: defs.quickActions.filter((q) => q.id !== id),
})

/**
 * A shortcut points at a type, not a category: pressing it lists the type's categories. It keeps a
 * category only when that one still belongs to the type, or for water, which records at once and
 * needs one.
 */
export function quickActionCategory(
  type: EntryType,
  categoryId: string,
  categories: Category[],
): string {
  const own = categories.filter((c) => c.entryType === type && !c.archived)
  if (own.some((c) => c.id === categoryId)) return categoryId
  return type === 'water' ? (own[0]?.id ?? '') : ''
}

/** Categories a shortcut offers when pressed: its type's, narrowed to `categoryIds` when it has any. */
export function quickActionChoices(
  action: Pick<QuickAction, 'type' | 'categoryIds'>,
  categories: Category[],
): Category[] {
  const own = categories.filter((c) => c.entryType === action.type && !c.archived)
  const chosen = own.filter((c) => action.categoryIds?.includes(c.id))
  return (chosen.length > 0 ? chosen : own).sort((a, b) => a.order - b.order)
}

/** Selection to store: only ids of the type, and undefined (= all, including future ones) for none or every one. */
export function cleanCategoryIds(
  type: EntryType,
  ids: string[],
  categories: Category[],
): string[] | undefined {
  const own = categories.filter((c) => c.entryType === type && !c.archived)
  const kept = own.filter((c) => ids.includes(c.id)).map((c) => c.id)
  return kept.length === 0 || kept.length === own.length ? undefined : kept
}

/** A quick action must point at a category of its own entry type; returns the problem, or null. */
export function validateQuickAction(a: QuickAction, categories: Category[]): string | null {
  if (a.name.trim() === '') return 'Nhập tên nút.'
  if (a.categoryId && categories.find((c) => c.id === a.categoryId)?.entryType !== a.type) {
    return 'Danh mục không cùng loại với nút.'
  }
  return null
}

export const tagName = (tags: Tag[], id: string): string | null =>
  tags.find((t) => t.id === id)?.name ?? null

/** Value of the "Loại" select in the quick-button editor that means "make a new type named like the button". */
export const NEW_QUICK_TYPE = '__new'

export type DefKind = 'cat' | 'quick' | 'tag' | 'type'

/**
 * Applies an editor draft to the defs: trims the name, and for a quick button resolves its category,
 * the categories it offers and a type created on the spot. Returns the new defs, or the message to show.
 */
export function applyDefDraft(
  kind: DefKind,
  draft: Record<string, unknown>,
  defs: Defs,
): { defs: Defs } | { error: string } {
  const str = (k: string) => String(draft[k] ?? '')
  const name = str('name').trim()
  if (name === '') return { error: 'Nhập tên.' }
  if (kind === 'cat')
    return {
      defs: {
        ...defs,
        categories: upsertById(defs.categories, { ...draft, name } as unknown as Category),
      },
    }
  if (kind === 'type')
    return {
      defs: {
        ...defs,
        customTypes: upsertById(defs.customTypes ?? [], {
          ...draft,
          name,
        } as unknown as CustomType),
      },
    }
  if (kind === 'tag')
    return { defs: { ...defs, tags: upsertById(defs.tags, { ...draft, name } as unknown as Tag) } }

  const value = str('value').trim() === '' ? null : Number(str('value').replace(',', '.'))
  if (value !== null && Number.isNaN(value)) return { error: 'Giá trị không hợp lệ.' }
  // "Loại mới": the button brings its own type, named like the button; categories are added to it afterwards.
  const created = str('type') === NEW_QUICK_TYPE ? newCustomType(name, str('icon') || '📌') : null
  const buttonType = created ? created.id : (str('type') as EntryType)
  const a = {
    ...draft,
    name,
    title: name,
    type: buttonType,
    categoryId: quickActionCategory(buttonType, str('categoryId'), defs.categories),
    categoryIds: created
      ? undefined
      : cleanCategoryIds(
          buttonType,
          (draft.categoryIds as string[] | undefined) ?? [],
          defs.categories,
        ),
    value: buttonType === 'water' ? value : null,
    unit: buttonType === 'water' ? str('unit') : '',
  } as unknown as QuickAction
  const problem = validateQuickAction(a, defs.categories)
  if (problem) return { error: problem }
  return {
    defs: {
      ...defs,
      ...(created && { customTypes: [...(defs.customTypes ?? []), created] }),
      quickActions: upsertById(defs.quickActions, a),
    },
  }
}
