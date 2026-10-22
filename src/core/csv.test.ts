import { describe, expect, it } from 'vitest'
import { entriesToCsv } from './backup'
import { defaultDefs } from './defaults'
import { csvToEntries, parseCsv } from './csv'
import type { Entry } from './types'

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas and newlines inside cells, CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,"x, ""y"""\r\n"l1\nl2",3\r\n')).toEqual([
      ['a', 'b'],
      ['1', 'x, "y"'],
      ['l1\nl2', '3'],
    ])
  })
  it('keeps empty cells, ignores blank lines, no trailing newline needed', () => {
    expect(parseCsv('a,b,c\n1,,3\n\n4,5,6')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
      ['4', '5', '6'],
    ])
  })
})

const defs = defaultDefs('2026-11-01')
const ctx = {
  categories: defs.categories,
  tags: [{ id: 'tag-1', name: 'OT', color: '' }],
  dayStartHour: 4,
  deviceId: 'dev',
  now: '2026-11-02T10:00:00.000+07:00',
  newId: (() => {
    let i = 0
    return () => `id${i++}`
  })(),
}

describe('csvToEntries', () => {
  it('round-trips our own export (times, category by name, tags, payload, value)', () => {
    const e = {
      id: 'x',
      type: 'meal',
      dateKey: '2026-11-02',
      start: '2026-11-02T12:00:00.000+07:00',
      end: '2026-11-02T12:30:00.000+07:00',
      categoryId: 'cat-lunch',
      title: 'Cơm, "gà"',
      value: 1.5,
      unit: 'phần',
      rating: 4,
      tags: ['tag-1'],
      photoIds: [],
      payload: { place: 'office' },
      source: 'manual',
      note: 'dòng 1\ndòng 2',
      createdAt: '',
      updatedAt: '',
      deviceId: 'd',
      deleted: false,
      dirty: 0,
    } as Entry
    const csv = entriesToCsv([e], defs.categories, ctx.tags)
    const r = csvToEntries(parseCsv(csv), ctx)
    expect(r.errors).toEqual([])
    expect(r.entries).toHaveLength(1)
    expect(r.entries[0]).toMatchObject({
      type: 'meal',
      dateKey: '2026-11-02',
      start: e.start,
      end: e.end,
      categoryId: 'cat-lunch',
      title: 'Cơm, "gà"',
      value: 1.5,
      unit: 'phần',
      rating: 4,
      payload: { place: 'office' },
      note: 'dòng 1\ndòng 2',
      dirty: 1,
      deviceId: 'dev',
    })
    expect(r.entries[0]!.tags).toEqual(['tag-1']) // exported as the name "OT", read back as the same tag
  })
  it('accepts a minimal file, reads zone-less times as Vietnam time and assigns the logical day', () => {
    const r = csvToEntries(
      parseCsv('start,type,title\n2026-11-03 01:30,sleep,Ngủ\n2026-11-03T09:00,work,Code'),
      ctx,
    )
    expect(r.entries.map((e) => [e.start, e.dateKey])).toEqual([
      ['2026-11-03T01:30:00.000+07:00', '2026-11-02'],
      ['2026-11-03T09:00:00.000+07:00', '2026-11-03'],
    ])
  })
  it('accepts the study type', () => {
    const r = csvToEntries(parseCsv('start,type,title\n2026-11-03 20:00,study,Học BA'), ctx)
    expect(r.entries.map((x) => x.type)).toEqual(['study'])
  })
  it('matches category names case-insensitively, keeps unknown ones, resolves known tags and lists new ones', () => {
    const r = csvToEntries(
      parseCsv(
        'start,type,category,tags\n2026-11-02 12:00,meal,ăn TRƯA,OT;mới\n2026-11-02 13:00,meal,Phở,',
      ),
      ctx,
    )
    expect(r.entries[0]!.categoryId).toBe('cat-lunch')
    expect(r.entries[0]!.tags).toEqual(['tag-1', 'name:mới'])
    expect(r.newTags).toEqual(['mới'])
    expect(r.entries[1]!.categoryId).toBe('')
    expect(r.entries[1]!.payload).toEqual({ importedCategory: 'Phở' })
  })
  it('skips bad rows with the line number and reason, and rejects files without the key columns', () => {
    const r = csvToEntries(
      parseCsv(
        'start,type,end,payload\nxyz,meal,,\n2026-11-02 12:00,bogus,,\n2026-11-02 12:00,meal,2026-11-02 11:00,\n2026-11-02 12:00,meal,,{oops\n2026-11-02 12:00,meal,,',
      ),
      ctx,
    )
    expect(r.entries).toHaveLength(1)
    expect(r.errors.map((x) => x.line)).toEqual([2, 3, 4, 5])
    expect(csvToEntries(parseCsv('title\nx'), ctx).errors[0]!.reason).toMatch(/Thiếu cột/)
    expect(csvToEntries([], ctx).errors).toHaveLength(1)
  })
})
