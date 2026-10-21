import Dexie, { type Table } from 'dexie'
import type { Day, Defs, Entry, InsightStore, PhotoRecord, Settings } from '../core/types'

/** Single-document tables (defs, settings) sync as whole files, so they carry file-level stamps. */
export interface DocStamp {
  updatedAt: string
  deviceId: string
  dirty: 0 | 1
}

export type DefsRecord = Defs & DocStamp & { key: 'defs' }
export type SettingsRecord = Settings & DocStamp & { key: 'settings' }
export type InsightsRecord = InsightStore & DocStamp & { key: 'insights' }
export interface MetaRecord {
  key: string
  value: unknown
}

export class NhatKyDB extends Dexie {
  entries!: Table<Entry, string>
  days!: Table<Day, string>
  defs!: Table<DefsRecord, string>
  settings!: Table<SettingsRecord, string>
  insights!: Table<InsightsRecord, string>
  photos!: Table<PhotoRecord, string>
  meta!: Table<MetaRecord, string>

  constructor(name = 'nhat-ky') {
    super(name)
    this.version(1).stores({
      entries: 'id, dateKey, type, [type+dateKey], dirty',
      days: 'dateKey, dirty',
      defs: 'key',
      settings: 'key',
      photos: 'id, uploaded',
      meta: 'key',
    })
    // v2 only adds a table; nothing is migrated.
    this.version(2).stores({ insights: 'key' })
  }
}

export const db = new NhatKyDB()
