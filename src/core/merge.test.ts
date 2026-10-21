import { describe, expect, it } from 'vitest'
import { compareVersion, mergeRecords } from './merge'

interface Rec {
  id: string
  v: string
  deleted: boolean
  updatedAt: string
  deviceId: string
}

const rec = (id: string, updatedAt: string, extra: Partial<Rec> = {}): Rec => ({
  id,
  v: 'x',
  deleted: false,
  updatedAt,
  deviceId: 'A',
  ...extra,
})
const key = (r: Rec) => r.id
const T1 = '2026-10-21T10:00:00.000+07:00'
const T2 = '2026-10-21T10:05:00.000+07:00'

describe('compareVersion', () => {
  it('compares instants, not strings (different offsets)', () => {
    expect(
      compareVersion(
        { updatedAt: '2026-10-21T10:00:00+07:00', deviceId: 'A' },
        { updatedAt: '2026-10-21T02:00:00Z', deviceId: 'A' },
      ),
    ).toBeGreaterThan(0)
  })
  it('breaks ties by deviceId, and equal versions are 0', () => {
    expect(
      compareVersion({ updatedAt: T1, deviceId: 'B' }, { updatedAt: T1, deviceId: 'A' }),
    ).toBeGreaterThan(0)
    expect(compareVersion({ updatedAt: T1, deviceId: 'A' }, { updatedAt: T1, deviceId: 'A' })).toBe(
      0,
    )
  })
})

describe('mergeRecords', () => {
  it('newer remote wins', () => {
    const r = mergeRecords([rec('1', T1, { v: 'old' })], [rec('1', T2, { v: 'new' })], key)
    expect(r.merged).toHaveLength(1)
    expect(r.merged[0].v).toBe('new')
    expect(r.remoteWon.map((x) => x.v)).toEqual(['new'])
    expect(r.localWon).toBe(false)
  })

  it('newer local wins and must be pushed', () => {
    const r = mergeRecords([rec('1', T2, { v: 'new' })], [rec('1', T1, { v: 'old' })], key)
    expect(r.merged[0].v).toBe('new')
    expect(r.remoteWon).toEqual([])
    expect(r.localWon).toBe(true)
  })

  it('a newer soft-delete wins over an older edit, and loses to a newer edit', () => {
    const del = mergeRecords([rec('1', T1)], [rec('1', T2, { deleted: true })], key)
    expect(del.merged[0].deleted).toBe(true)
    const edit = mergeRecords([rec('1', T2)], [rec('1', T1, { deleted: true })], key)
    expect(edit.merged[0].deleted).toBe(false)
    expect(edit.localWon).toBe(true)
  })

  it('keeps records that exist on one side only, without duplicating', () => {
    const r = mergeRecords([rec('1', T1), rec('2', T1)], [rec('2', T1), rec('3', T1)], key)
    expect(r.merged.map((x) => x.id).sort()).toEqual(['1', '2', '3'])
    expect(r.remoteWon.map((x) => x.id)).toEqual(['3'])
    expect(r.localWon).toBe(true) // '1' is missing remotely
  })

  it('identical versions change nothing', () => {
    const r = mergeRecords([rec('1', T1)], [rec('1', T1)], key)
    expect(r.remoteWon).toEqual([])
    expect(r.localWon).toBe(false)
  })

  it('is order independent on ties (both devices pick the same winner)', () => {
    const a = rec('1', T1, { deviceId: 'A', v: 'fromA' })
    const b = rec('1', T1, { deviceId: 'B', v: 'fromB' })
    expect(mergeRecords([a], [b], key).merged[0].v).toBe('fromB')
    expect(mergeRecords([b], [a], key).merged[0].v).toBe('fromB')
  })

  it('handles empty sides', () => {
    expect(mergeRecords<Rec>([], [], key)).toEqual({ merged: [], remoteWon: [], localWon: false })
    expect(mergeRecords([rec('1', T1)], [], key).localWon).toBe(true)
  })
})
