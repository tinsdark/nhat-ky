import { csvToEntries, parseCsv, type CsvImport } from '../core/csv'
import { newId } from '../core/defs'
import { db } from '../data/db'
import { getDefs, getDeviceId, getSettings, saveDefs } from '../data/repository'

export interface ImportResult {
  imported: number
  duplicates: number
  errors: CsvImport['errors']
  newTags: string[]
}

/**
 * Imports a CSV (SPEC 9.3). A row whose type, start and title match an entry already stored is
 * skipped, so importing the same file twice changes nothing. Unknown tags are created.
 */
export async function importCsv(text: string): Promise<ImportResult> {
  const [defs, settings, deviceId] = await Promise.all([getDefs(), getSettings(), getDeviceId()])
  const parsed = csvToEntries(parseCsv(text), {
    categories: defs.categories,
    tags: defs.tags,
    dayStartHour: settings.dayStartHour,
    deviceId,
  })

  const created = parsed.newTags.map((name) => ({ id: newId('tag'), name, color: '#6c6c70' }))
  if (created.length > 0) await saveDefs({ ...defs, tags: [...defs.tags, ...created] })
  const tagId = new Map(created.map((t) => [`name:${t.name}`, t.id]))

  const keys = new Set<string>()
  const dateKeys = [...new Set(parsed.entries.map((e) => e.dateKey))]
  for (const dateKey of dateKeys) {
    for (const e of await db.entries.where('dateKey').equals(dateKey).toArray()) {
      if (!e.deleted) keys.add(`${e.type}|${e.start}|${e.title}`)
    }
  }
  const fresh = []
  let duplicates = 0
  for (const e of parsed.entries) {
    const key = `${e.type}|${e.start}|${e.title}`
    if (keys.has(key)) {
      duplicates++
      continue
    }
    keys.add(key)
    fresh.push({ ...e, tags: e.tags.map((t) => tagId.get(t) ?? t) })
  }
  await db.entries.bulkAdd(fresh)
  return { imported: fresh.length, duplicates, errors: parsed.errors, newTags: parsed.newTags }
}
