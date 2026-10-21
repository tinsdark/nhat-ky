import { weekday } from './date'
import type { Category, Entry, Tag } from './types'

export const BACKUP_PREFIX = 'nk_backup_'
export const BACKUP_KEEP = 8

export const backupName = (dateKey: string) => `${BACKUP_PREFIX}${dateKey}.json`

/** A snapshot is due on Sundays when none exists for that Sunday yet. `dateKey` is the Vietnam calendar date. */
export function backupDue(dateKey: string, existingNames: string[]): boolean {
  return weekday(dateKey) === 6 && !existingNames.includes(backupName(dateKey))
}

/** Names to delete so only the newest `keep` snapshots remain (names sort by date). */
export function backupsToDelete(names: string[], keep = BACKUP_KEEP): string[] {
  return names
    .filter((n) => n.startsWith(BACKUP_PREFIX))
    .sort()
    .reverse()
    .slice(keep)
}

const BOM = String.fromCharCode(0xfeff)

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const CSV_COLUMNS = [
  'dateKey',
  'start',
  'end',
  'type',
  'category',
  'title',
  'value',
  'unit',
  'rating',
  'tags',
  'note',
  'payload',
] as const

/** Entries as CSV (UTF-8 with BOM so Excel reads Vietnamese). Photos are not included. */
export function entriesToCsv(entries: Entry[], categories: Category[], tags: Tag[] = []): string {
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const tagNames = new Map(tags.map((t) => [t.id, t.name]))
  const lines = [CSV_COLUMNS.join(',')]
  for (const e of [...entries].sort((a, b) => a.start.localeCompare(b.start))) {
    if (e.deleted) continue
    lines.push(
      [
        e.dateKey,
        e.start,
        e.end,
        e.type,
        names.get(e.categoryId) ?? e.categoryId,
        e.title,
        e.value,
        e.unit,
        e.rating,
        e.tags.map((id) => tagNames.get(id) ?? id).join(';'),
        e.note,
        Object.keys(e.payload).length ? JSON.stringify(e.payload) : '',
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return `${BOM}${lines.join('\r\n')}\r\n`
}
