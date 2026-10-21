import type { Day, Entry } from './types'

export const GAP_MINUTES = 120

export type TimelineRow =
  { kind: 'entry'; entry: Entry; minutes: number } | { kind: 'gap'; start: string; end: string }

const ms = (ts: string) => new Date(ts).getTime()

/**
 * Orders entries by start and inserts a gap row wherever more than `gapMinutes` pass with nothing
 * recorded. Open entries (no end) count as a point. For today, the stretch from the last recorded
 * moment up to `now` is a gap too; past days get no trailing gap.
 */
export function buildTimeline(
  entries: Entry[],
  opts: { now?: number; gapMinutes?: number } = {},
): TimelineRow[] {
  const gapMs = (opts.gapMinutes ?? GAP_MINUTES) * 60_000
  const sorted = [...entries].sort((a, b) => a.start.localeCompare(b.start))
  const rows: TimelineRow[] = []
  let covered = -Infinity
  let coveredIso = ''
  for (const entry of sorted) {
    const s = ms(entry.start)
    if (covered > -Infinity && s - covered > gapMs) {
      rows.push({ kind: 'gap', start: coveredIso, end: entry.start })
    }
    const endIso = entry.end ?? entry.start
    const e = Math.max(s, ms(endIso))
    rows.push({ kind: 'entry', entry, minutes: Math.round((e - s) / 60_000) })
    if (e > covered) {
      covered = e
      coveredIso = endIso
    }
  }
  if (opts.now !== undefined && covered > -Infinity && opts.now - covered > gapMs) {
    rows.push({ kind: 'gap', start: coveredIso, end: new Date(opts.now).toISOString() })
  }
  return rows
}

export interface CoreItem {
  id: 'sleep' | 'breakfast' | 'lunch' | 'dinner' | 'work' | 'rating'
  label: string
  done: boolean
}

const MEAL_CATEGORY: Record<string, CoreItem['id']> = {
  'cat-breakfast': 'breakfast',
  'cat-lunch': 'lunch',
  'cat-dinner': 'dinner',
}

/** The "x/y core items recorded" bar: sleep, three meals, work, and the end-of-day rating. */
export function coreProgress(entries: Entry[], day: Day | undefined): CoreItem[] {
  const has = (pred: (e: Entry) => boolean) => entries.some(pred)
  const meal = (id: CoreItem['id']) =>
    has((e) => e.type === 'meal' && MEAL_CATEGORY[e.categoryId] === id)
  return [
    { id: 'sleep', label: 'Ngủ', done: has((e) => e.type === 'sleep') },
    { id: 'breakfast', label: 'Sáng', done: meal('breakfast') },
    { id: 'lunch', label: 'Trưa', done: meal('lunch') },
    { id: 'dinner', label: 'Tối', done: meal('dinner') },
    { id: 'work', label: 'Làm việc', done: has((e) => e.type === 'work') },
    { id: 'rating', label: 'Chấm ngày', done: day?.dayScore != null },
  ]
}
