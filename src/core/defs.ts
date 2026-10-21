import type { Category, Defs, EntryType, QuickAction, Tag } from './types'

export const ENTRY_TYPES: { id: EntryType; label: string }[] = [
  { id: 'sleep', label: 'Ngủ' },
  { id: 'meal', label: 'Ăn uống' },
  { id: 'work', label: 'Làm việc' },
  { id: 'activity', label: 'Hoạt động' },
  { id: 'exercise', label: 'Vận động' },
  { id: 'water', label: 'Uống nước' },
  { id: 'note', label: 'Check-in / ghi chú' },
]

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
