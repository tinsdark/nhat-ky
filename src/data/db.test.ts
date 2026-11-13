import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { NhatKyDB } from './db'

/**
 * Upgrades must keep data written by older versions. Each new `this.version(n)` in db.ts gets a case
 * here: open the previous schema, write rows the way that version did, reopen with NhatKyDB.
 */
describe('schema upgrades', () => {
  it('v1 data survives the upgrade to the current schema', async () => {
    const name = `upgrade-${crypto.randomUUID()}`
    const v1 = new Dexie(name)
    v1.version(1).stores({
      entries: 'id, dateKey, type, [type+dateKey], dirty',
      days: 'dateKey, dirty',
      defs: 'key',
      settings: 'key',
      photos: 'id, uploaded',
      meta: 'key',
    })
    await v1.table('entries').put({ id: 'e1', dateKey: '2026-11-01', type: 'meal', dirty: 0 })
    await v1.table('days').put({ dateKey: '2026-11-01', dayScore: 7, dirty: 1 })
    await v1.table('meta').put({ key: 'deviceId', value: 'dev-1' })
    v1.close()

    const db = new NhatKyDB(name)
    expect(await db.entries.get('e1')).toMatchObject({ type: 'meal' })
    expect(await db.entries.where('[type+dateKey]').equals(['meal', '2026-11-01']).count()).toBe(1)
    expect(await db.days.where('dirty').equals(1).count()).toBe(1)
    expect((await db.meta.get('deviceId'))?.value).toBe('dev-1')
    expect(await db.insights.count()).toBe(0) // table added in v2
    expect(db.verno).toBe(2)
    db.close()
  })
})
