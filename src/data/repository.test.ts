import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  createEntry,
  getDay,
  getDaysInRange,
  getDefs,
  getDeviceId,
  getEntriesByDateKey,
  getEntriesInRange,
  getSettings,
  restoreEntry,
  saveDay,
  saveDefs,
  saveSettings,
  softDeleteEntry,
  updateEntry,
} from './repository'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('deviceId', () => {
  it('is generated once and survives reopening the db', async () => {
    const a = await getDeviceId()
    expect(await getDeviceId()).toBe(a)
    db.close()
    await db.open()
    expect(await getDeviceId()).toBe(a)
  })

  it('is the same under concurrent first calls', async () => {
    const ids = await Promise.all([getDeviceId(), getDeviceId(), getDeviceId()])
    expect(new Set(ids).size).toBe(1)
  })
})

describe('entries', () => {
  it('create stamps updatedAt, deviceId, dirty = 1', async () => {
    const e = await createEntry({ type: 'meal', start: '2026-10-19T12:00:00+07:00', title: 'Phở' })
    expect(e.dirty).toBe(1)
    expect(e.deleted).toBe(false)
    expect(e.deviceId).toBe(await getDeviceId())
    expect(e.updatedAt).toMatch(/\+07:00$/)
    expect(e.createdAt).toBe(e.updatedAt)
    expect(await db.entries.get(e.id)).toEqual(e)
  })

  it('update keeps createdAt, bumps updatedAt, re-marks dirty', async () => {
    const e = await createEntry({ type: 'meal', start: '2026-10-19T12:00:00+07:00' })
    await db.entries.update(e.id, { dirty: 0 })
    await new Promise((r) => setTimeout(r, 5))
    const u = await updateEntry(e.id, { title: 'Bún bò' })
    expect(u.title).toBe('Bún bò')
    expect(u.createdAt).toBe(e.createdAt)
    expect(u.updatedAt > e.updatedAt).toBe(true)
    expect(u.dirty).toBe(1)
  })

  it('update throws on a missing id', async () => {
    await expect(updateEntry('nope', { title: 'x' })).rejects.toThrow()
  })

  it('softDelete hides the entry but keeps the row', async () => {
    const e = await createEntry({ type: 'water', start: '2026-10-19T09:00:00+07:00' })
    await db.entries.update(e.id, { dirty: 0 })
    await softDeleteEntry(e.id)
    expect(await getEntriesByDateKey('2026-10-19')).toEqual([])
    expect(await getEntriesInRange('2026-10-01', '2026-10-31')).toEqual([])
    const row = await db.entries.get(e.id)
    expect(row?.deleted).toBe(true)
    expect(row?.dirty).toBe(1)
  })

  it('getByDateKey / getRange respect bounds and order by start', async () => {
    await createEntry({ type: 'meal', start: '2026-10-19T18:00:00+07:00', title: 'b' })
    await createEntry({ type: 'meal', start: '2026-10-19T07:00:00+07:00', title: 'a' })
    await createEntry({ type: 'meal', start: '2026-10-20T07:00:00+07:00', title: 'c' })
    await createEntry({ type: 'meal', start: '2026-10-21T07:00:00+07:00', title: 'd' })
    expect((await getEntriesByDateKey('2026-10-19')).map((e) => e.title)).toEqual(['a', 'b'])
    expect((await getEntriesInRange('2026-10-19', '2026-10-20')).map((e) => e.title)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('[type+dateKey] index is queryable', async () => {
    await createEntry({ type: 'meal', start: '2026-10-19T07:00:00+07:00' })
    await createEntry({ type: 'water', start: '2026-10-19T08:00:00+07:00' })
    const meals = await db.entries.where('[type+dateKey]').equals(['meal', '2026-10-19']).toArray()
    expect(meals).toHaveLength(1)
  })

  it('00:40 Tuesday is assigned to Monday', async () => {
    const e = await createEntry({ type: 'sleep', start: '2026-10-20T00:40:00+07:00' })
    expect(e.dateKey).toBe('2026-10-19')
  })

  it('dayStartHour from settings changes dateKey, also on update', async () => {
    await saveSettings({ dayStartHour: 5 })
    const e = await createEntry({ type: 'sleep', start: '2026-10-20T04:30:00+07:00' })
    expect(e.dateKey).toBe('2026-10-19')
    const u = await updateEntry(e.id, { start: '2026-10-20T05:10:00+07:00' })
    expect(u.dateKey).toBe('2026-10-20')
  })
})

describe('days', () => {
  it('saveDay creates then merges, keeping createdAt', async () => {
    const a = await saveDay('2026-10-19', { energy: 4 })
    expect(a.dirty).toBe(1)
    expect(a.mood).toBeNull()
    await new Promise((r) => setTimeout(r, 5))
    const b = await saveDay('2026-10-19', { dayScore: 8 })
    expect(b.energy).toBe(4)
    expect(b.dayScore).toBe(8)
    expect(b.createdAt).toBe(a.createdAt)
    expect(b.updatedAt > a.updatedAt).toBe(true)
    expect((await getDay('2026-10-19'))?.dayScore).toBe(8)
    expect(await getDay('2026-10-18')).toBeUndefined()
  })

  it('getDaysInRange is inclusive', async () => {
    await saveDay('2026-10-18', {})
    await saveDay('2026-10-19', {})
    await saveDay('2026-10-20', {})
    expect((await getDaysInRange('2026-10-19', '2026-10-20')).map((d) => d.dateKey)).toEqual([
      '2026-10-19',
      '2026-10-20',
    ])
  })
})

describe('settings & defs', () => {
  it('settings fall back to defaults and merge patches', async () => {
    expect((await getSettings()).dayStartHour).toBe(4)
    await saveSettings({ waterTargetMl: 2500 })
    const s = await getSettings()
    expect(s.waterTargetMl).toBe(2500)
    expect(s.sleepTargetHours).toBe(7.5)
    expect((await db.settings.get('settings'))?.dirty).toBe(1)
  })

  it('defs round-trip and are marked dirty', async () => {
    expect(await getDefs()).toEqual({ categories: [], habits: [], quickActions: [], tags: [] })
    const defs = {
      categories: [],
      habits: [],
      quickActions: [],
      tags: [{ id: 't1', name: 'cà phê', color: '#a0522d' }],
    }
    await saveDefs(defs)
    expect(await getDefs()).toEqual(defs)
    expect((await db.defs.get('defs'))?.dirty).toBe(1)
  })
})

describe('restoreEntry', () => {
  it('brings a soft-deleted entry back and marks it dirty', async () => {
    const e = await createEntry({ type: 'note', start: '2026-11-02T10:00:00.000+07:00' })
    await softDeleteEntry(e.id)
    expect(await getEntriesByDateKey(e.dateKey)).toHaveLength(0)
    await db.entries.update(e.id, { dirty: 0 })
    await restoreEntry(e.id)
    expect(await getEntriesByDateKey(e.dateKey)).toHaveLength(1)
    expect((await db.entries.get(e.id))?.dirty).toBe(1)
  })
})

describe('work overtime', () => {
  it('sets payload.isOvertime from the working hours on create and update', async () => {
    const inside = await createEntry({
      type: 'work',
      start: '2026-11-02T09:00:00.000+07:00',
      end: '2026-11-02T11:00:00.000+07:00',
    })
    expect(inside.payload.isOvertime).toBe(false)
    const moved = await updateEntry(inside.id, {
      start: '2026-11-02T19:00:00.000+07:00',
      end: '2026-11-02T20:00:00.000+07:00',
    })
    expect(moved.payload.isOvertime).toBe(true)
    const open = await createEntry({ type: 'work', start: '2026-11-02T09:00:00.000+07:00' })
    expect(open.payload.isOvertime).toBeUndefined()
    const other = await createEntry({
      type: 'meal',
      start: '2026-11-02T19:00:00.000+07:00',
      end: '2026-11-02T20:00:00.000+07:00',
    })
    expect(other.payload.isOvertime).toBeUndefined()
  })
})

describe('time format', () => {
  it('stores start and end with the +07:00 offset even when given UTC', async () => {
    const e = await createEntry({
      type: 'note',
      start: '2026-11-02T05:00:00.000Z',
      end: '2026-11-02T06:00:00.000Z',
    })
    expect(e.start).toBe('2026-11-02T12:00:00.000+07:00')
    expect(e.end).toBe('2026-11-02T13:00:00.000+07:00')
    expect(e.dateKey).toBe('2026-11-02')
  })
})
