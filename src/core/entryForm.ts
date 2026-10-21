import type { Entry, EntryType } from './types'

/** Titles used before for this entry type, most frequent first (ties: most recently used first). */
export function suggestTitles(history: Entry[], type: EntryType, limit = 8): string[] {
  const stats = new Map<string, { count: number; last: string }>()
  for (const e of history) {
    const title = e.title.trim()
    if (e.type !== type || e.deleted || title === '') continue
    const s = stats.get(title) ?? { count: 0, last: '' }
    s.count += 1
    if (e.start > s.last) s.last = e.start
    stats.set(title, s)
  }
  return [...stats.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))
    .slice(0, limit)
    .map(([title]) => title)
}

/** Moves `HH:mm` by `deltaMin` minutes, wrapping around midnight. */
export function shiftHHmm(hhmm: string, deltaMin: number): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Other entries of the same type whose time range overlaps [start, end). Open entries (no end)
 * are ignored: only blocks with a duration can conflict. Used for a non-blocking warning.
 */
export function findOverlaps(
  others: Entry[],
  type: EntryType,
  start: string,
  end: string | null,
  excludeId?: string,
): Entry[] {
  if (end === null) return []
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  return others.filter((o) => {
    if (o.id === excludeId || o.deleted || o.type !== type || o.end === null) return false
    return new Date(o.start).getTime() < e && new Date(o.end).getTime() > s
  })
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'late'

const SLOT_BY_CATEGORY: Record<string, MealSlot> = {
  'cat-breakfast': 'breakfast',
  'cat-lunch': 'lunch',
  'cat-dinner': 'dinner',
  'cat-snack': 'snack',
}

/** Slot from the category; otherwise `late` after 22:00 or before 04:00, else a snack. */
export function autoMealSlot(categoryId: string, hhmm: string): MealSlot {
  const fromCategory = SLOT_BY_CATEGORY[categoryId]
  if (fromCategory) return fromCategory
  const hour = Number(hhmm.slice(0, 2))
  return hour >= 22 || hour < 4 ? 'late' : 'snack'
}
