import { atTime, toHHmm } from './date'
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

/**
 * Slot from the category; otherwise from the hour: 04–10 sáng, 10–15 trưa, 15–17:30 phụ, 17:30–22 tối,
 * and `late` from 22:00 to 04:00 (SPEC 3.2).
 */
export function autoMealSlot(categoryId: string, hhmm: string): MealSlot {
  const fromCategory = SLOT_BY_CATEGORY[categoryId]
  if (fromCategory) return fromCategory
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const minutes = h * 60 + m
  if (minutes >= 22 * 60 || minutes < 4 * 60) return 'late'
  if (minutes < 10 * 60) return 'breakfast'
  if (minutes < 15 * 60) return 'lunch'
  if (minutes < 17 * 60 + 30) return 'snack'
  return 'dinner'
}

/** Fields for a copy of `entry` placed on `targetDateKey` at the same clock times. */
export function copyToDay(entry: Entry, targetDateKey: string, dayStartHour: number) {
  return {
    type: entry.type,
    categoryId: entry.categoryId,
    title: entry.title,
    value: entry.value,
    unit: entry.unit,
    rating: entry.rating,
    tags: [...entry.tags],
    payload: { ...entry.payload },
    note: entry.note,
    start: atTime(targetDateKey, toHHmm(entry.start), dayStartHour),
    end: entry.end ? atTime(targetDateKey, toHHmm(entry.end), dayStartHour) : null,
    source: 'manual' as const,
  }
}

/** Longest block the form accepts. */
export const MAX_BLOCK_HOURS = 16

/** Duration estimates offered as chips, in minutes. */
export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240]

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

/** "1h30", "45p". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}p`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/**
 * The end of a block whose end time was typed as a clock time on the same logical day: an end at or
 * before the start means the next day (sleep 23:30 → 06:30). Null when that would exceed 16 hours,
 * which is almost certainly a typo.
 */
export function resolveEnd(startIso: string, endIso: string): string | null {
  const s = new Date(startIso).getTime()
  let e = new Date(endIso).getTime()
  if (e <= s) e += 24 * 3_600_000
  return e - s > MAX_BLOCK_HOURS * 3_600_000 ? null : new Date(e).toISOString()
}
