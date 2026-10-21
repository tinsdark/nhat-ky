import { toDateKey, toIso } from './date'
import type { Category, Entry, EntryType, Tag } from './types'

/** RFC 4180 CSV: quoted cells, doubled quotes, newlines inside quotes, CRLF or LF. A leading BOM is ignored. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const TYPES: EntryType[] = [
  'sleep',
  'meal',
  'work',
  'habit',
  'exercise',
  'activity',
  'water',
  'note',
]

export interface CsvImport {
  /** Entries ready to store (id, dateKey and sync fields filled in). */
  entries: Entry[]
  /** Tag names seen that are not in `tags` yet. */
  newTags: string[]
  /** 1-based file line → reason, for rows that were skipped. */
  errors: { line: number; reason: string }[]
}

/**
 * Turns the rows of a CSV (our own export, or any file with at least `start` and `type` columns) into
 * entries. Times without an offset are read as Vietnam time. Category names are matched to existing
 * categories; unknown names are kept in `payload.importedCategory`.
 */
export function csvToEntries(
  rows: string[][],
  ctx: {
    categories: Category[]
    tags: Tag[]
    dayStartHour: number
    deviceId: string
    now?: string
    newId?: () => string
  },
): CsvImport {
  const out: CsvImport = { entries: [], newTags: [], errors: [] }
  const [header, ...body] = rows
  if (!header) return { ...out, errors: [{ line: 1, reason: 'File trống.' }] }
  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]))
  if (!col.has('start') || !col.has('type')) {
    return { ...out, errors: [{ line: 1, reason: 'Thiếu cột "start" hoặc "type".' }] }
  }
  const now = ctx.now ?? toIso()
  const newId = ctx.newId ?? (() => crypto.randomUUID())
  const known = new Map(ctx.tags.map((t) => [t.name.toLowerCase(), t.id]))
  const unknownTags = new Set<string>()

  body.forEach((r, i) => {
    const line = i + 2
    const get = (name: string) => (r[col.get(name) ?? -1] ?? '').trim()
    const type = get('type') as EntryType
    if (!TYPES.includes(type) && !type.startsWith('x-'))
      return void out.errors.push({ line, reason: `Loại "${get('type')}" không hợp lệ.` })
    const rawStart = get('start')
    const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(rawStart)
    const startMs = new Date(hasOffset ? rawStart : `${rawStart.replace(' ', 'T')}+07:00`).getTime()
    if (!rawStart || Number.isNaN(startMs))
      return void out.errors.push({ line, reason: 'Giờ bắt đầu không đọc được.' })
    const rawEnd = get('end')
    let endMs: number | null = null
    if (rawEnd) {
      endMs = new Date(
        /(Z|[+-]\d{2}:?\d{2})$/.test(rawEnd) ? rawEnd : `${rawEnd.replace(' ', 'T')}+07:00`,
      ).getTime()
      if (Number.isNaN(endMs) || endMs <= startMs)
        return void out.errors.push({ line, reason: 'Giờ kết thúc không hợp lệ.' })
    }
    let payload: Record<string, unknown> = {}
    const rawPayload = get('payload')
    if (rawPayload) {
      try {
        const parsed = JSON.parse(rawPayload)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed
      } catch {
        return void out.errors.push({ line, reason: 'Cột payload không phải JSON.' })
      }
    }
    const catName = get('category')
    const cat = ctx.categories.find(
      (c) => c.id === catName || c.name.toLowerCase() === catName.toLowerCase(),
    )
    if (catName && !cat) payload = { ...payload, importedCategory: catName }
    const tags = get('tags')
      .split(';')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((name) => {
        const id = known.get(name.toLowerCase())
        if (id) return id
        unknownTags.add(name)
        return `name:${name}` // resolved to a real id by the caller once the tags are created
      })
    const value = get('value') === '' ? null : Number(get('value').replace(',', '.'))
    const rating = get('rating') === '' ? null : Number(get('rating'))
    const start = toIso(startMs)
    out.entries.push({
      id: newId(),
      type,
      dateKey: toDateKey(start, ctx.dayStartHour),
      start,
      end: endMs === null ? null : toIso(endMs),
      categoryId: cat?.id ?? '',
      title: get('title'),
      value: value !== null && Number.isFinite(value) ? value : null,
      unit: get('unit'),
      rating: rating !== null && rating >= 1 && rating <= 5 ? (rating as Entry['rating']) : null,
      tags,
      photoIds: [],
      payload,
      source: 'manual',
      note: get('note'),
      createdAt: now,
      updatedAt: now,
      deviceId: ctx.deviceId,
      deleted: false,
      dirty: 1,
    })
  })
  out.newTags = [...unknownTags]
  return out
}
