// Deleting a range of days (Cài đặt → Dữ liệu): which days, and what a deleted record looks like.
import { toIso } from './date'
import type { Day, Entry } from './types'

/** `from = null` means from the very beginning. Both ends are included. */
export interface PurgeRange {
  from: string | null
  to: string
}

const isDateKey = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function parsePurgeRange(
  fromRaw: string,
  toRaw: string,
  today: string,
): { range: PurgeRange } | { error: string } {
  const from = fromRaw.trim()
  const to = toRaw.trim()
  if (to === '') return { error: 'Chọn "Đến ngày".' }
  if (!isDateKey(to) || (from !== '' && !isDateKey(from))) return { error: 'Ngày không hợp lệ.' }
  if (to > today) return { error: '"Đến ngày" không được ở tương lai.' }
  if (from !== '' && from > to) return { error: '"Từ ngày" phải trước hoặc bằng "Đến ngày".' }
  return { range: { from: from === '' ? null : from, to } }
}

export const inPurgeRange = (dateKey: string, r: PurgeRange): boolean =>
  dateKey <= r.to && (r.from === null || dateKey >= r.from)

/** Soft-deleted and emptied, so the removal reaches Drive and no content is left behind. */
export function scrubbedEntry(e: Entry, stamp: string, deviceId: string): Entry {
  return {
    ...e,
    deleted: true,
    title: '',
    note: '',
    value: null,
    unit: '',
    rating: null,
    tags: [],
    photoIds: [],
    payload: {},
    updatedAt: stamp,
    deviceId,
    dirty: 1,
  }
}

export function scrubbedDay(d: Day, stamp: string, deviceId: string): Day {
  return {
    ...d,
    deleted: true,
    mood: null,
    energy: null,
    stress: null,
    focus: null,
    dayScore: null,
    dayType: null,
    highlight: '',
    note: '',
    updatedAt: stamp,
    deviceId,
    dirty: 1,
  }
}

/**
 * The record as it was, stamped one second after the deletion: restoring it from the backup file only
 * takes records newer than the local copy, and the deleted copy is newer than the original.
 */
export function backupCopy<T extends { updatedAt: string }>(record: T, deletedAt: string): T {
  return { ...record, updatedAt: toIso(Date.parse(deletedAt) + 1000) }
}
