import { describe, expect, it } from 'vitest'
import type { Day, Entry } from './types'
import { backupCopy, inPurgeRange, parsePurgeRange, scrubbedDay, scrubbedEntry } from './purge'

const TODAY = '2026-10-22'

describe('parsePurgeRange', () => {
  it('needs an end date', () => {
    expect(parsePurgeRange('', '', TODAY)).toEqual({ error: 'Chọn "Đến ngày".' })
  })
  it('an empty start date means from the very beginning', () => {
    expect(parsePurgeRange('', '2026-10-10', TODAY)).toEqual({
      range: { from: null, to: '2026-10-10' },
    })
  })
  it('accepts both ends, equal ones too (a single day)', () => {
    expect(parsePurgeRange('2026-10-05', '2026-10-10', TODAY)).toEqual({
      range: { from: '2026-10-05', to: '2026-10-10' },
    })
    expect(parsePurgeRange('2026-10-10', '2026-10-10', TODAY)).toMatchObject({ range: {} })
  })
  it('refuses a start after the end, a future end and a garbage date', () => {
    expect(parsePurgeRange('2026-10-11', '2026-10-10', TODAY)).toHaveProperty('error')
    expect(parsePurgeRange('', '2026-10-23', TODAY)).toHaveProperty('error')
    expect(parsePurgeRange('', '2026-13-40', TODAY)).toHaveProperty('error')
    expect(parsePurgeRange('abc', '2026-10-10', TODAY)).toHaveProperty('error')
  })
  it('today itself is allowed', () => {
    expect(parsePurgeRange('', TODAY, TODAY)).toMatchObject({ range: { to: TODAY } })
  })
})

describe('inPurgeRange', () => {
  it('includes both ends; a null start has no lower bound', () => {
    const r = { from: '2026-10-05', to: '2026-10-10' }
    expect(
      ['2026-10-04', '2026-10-05', '2026-10-10', '2026-10-11'].map((d) => inPurgeRange(d, r)),
    ).toEqual([false, true, true, false])
    expect(inPurgeRange('2020-01-01', { from: null, to: '2026-10-10' })).toBe(true)
  })
})

describe('scrubbing', () => {
  const entry = {
    id: 'e1',
    type: 'meal',
    dateKey: '2026-10-10',
    start: '2026-10-10T12:00:00.000+07:00',
    end: null,
    categoryId: 'cat-lunch',
    title: 'Cơm',
    value: 1,
    unit: 'bát',
    rating: 4,
    tags: ['t'],
    photoIds: ['p1'],
    payload: { running: true },
    source: 'manual',
    note: 'ngon',
    createdAt: 'c',
    updatedAt: 'old',
    deviceId: 'A',
    deleted: false,
    dirty: 0,
  } as unknown as Entry
  const day = {
    dateKey: '2026-10-10',
    mood: 4,
    energy: 3,
    stress: 2,
    focus: 5,
    dayScore: 8,
    highlight: 'x',
    dayType: 'sick',
    note: 'y',
    createdAt: 'c',
    updatedAt: 'old',
    deviceId: 'A',
    deleted: false,
    dirty: 0,
  } as Day

  it('an entry becomes a deleted, empty shell that still syncs', () => {
    const s = scrubbedEntry(entry, 'NOW', 'B')
    expect(s).toMatchObject({
      id: 'e1',
      dateKey: '2026-10-10',
      deleted: true,
      title: '',
      note: '',
      payload: {},
      tags: [],
      photoIds: [],
      value: null,
      unit: '',
      rating: null,
      updatedAt: 'NOW',
      deviceId: 'B',
      dirty: 1,
    })
  })
  it('a day rating is cleared the same way', () => {
    const s = scrubbedDay(day, 'NOW', 'B')
    expect(s).toMatchObject({
      dateKey: '2026-10-10',
      deleted: true,
      mood: null,
      energy: null,
      stress: null,
      focus: null,
      dayScore: null,
      dayType: null,
      highlight: '',
      note: '',
      updatedAt: 'NOW',
      dirty: 1,
    })
  })
  it('a backup copy is stamped just after the deletion so restoring it wins the merge', () => {
    const copy = backupCopy(entry, '2026-10-22T10:00:00.000+07:00')
    expect(Date.parse(copy.updatedAt)).toBe(Date.parse('2026-10-22T10:00:00.000+07:00') + 1000)
    expect(copy.title).toBe('Cơm')
  })
})
