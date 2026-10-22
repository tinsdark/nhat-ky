// Shape checks for records that come from outside (Drive, backup files) before they reach IndexedDB.
import type { Day, Entry } from './types'

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))

/**
 * `updatedAt` must parse and not lie more than a day ahead: a far-future stamp would win every merge
 * for ever and could not be overwritten by a real edit.
 */
function hasSyncFields(r: Record<string, unknown>, now: number): boolean {
  return (
    isIso(r.updatedAt) &&
    Date.parse(r.updatedAt) <= now + DAY_MS &&
    isNonEmpty(r.deviceId) &&
    (r.deleted === undefined || typeof r.deleted === 'boolean')
  )
}

/** Whole-file documents (defs, settings, insights) only need a sane stamp. */
export function isDocStamp(v: unknown, now = Date.now()): boolean {
  return (
    isObject(v) &&
    isIso(v.updatedAt) &&
    Date.parse(v.updatedAt) <= now + DAY_MS &&
    isNonEmpty(v.deviceId)
  )
}

export function isEntry(v: unknown, now = Date.now()): v is Entry {
  if (!isObject(v) || !hasSyncFields(v, now)) return false
  return (
    isNonEmpty(v.id) &&
    isNonEmpty(v.type) &&
    typeof v.dateKey === 'string' &&
    DATE_KEY.test(v.dateKey) &&
    isIso(v.start) &&
    (v.end === null || isIso(v.end)) &&
    Array.isArray(v.tags) &&
    isObject(v.payload)
  )
}

export function isDay(v: unknown, now = Date.now()): v is Day {
  if (!isObject(v) || !hasSyncFields(v, now)) return false
  return typeof v.dateKey === 'string' && DATE_KEY.test(v.dateKey)
}

/** Keeps the records that pass `check`; `skipped` counts the rest. */
export function keepValid<T>(
  items: unknown[],
  check: (v: unknown) => v is T,
): { valid: T[]; skipped: number } {
  const valid = items.filter((v): v is T => check(v))
  return { valid, skipped: items.length - valid.length }
}
