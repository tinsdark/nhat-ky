import { describe, expect, it } from 'vitest'
import { backupDue, backupName, backupsToDelete, entriesToCsv } from './backup'
import type { Category, Entry } from './types'

describe('backup schedule', () => {
  it('is due on Sundays only, once', () => {
    expect(backupDue('2026-11-01', [])).toBe(true) // Sunday
    expect(backupDue('2026-11-02', [])).toBe(false) // Monday
    expect(backupDue('2026-11-01', [backupName('2026-11-01')])).toBe(false)
    expect(backupDue('2026-11-08', [backupName('2026-11-01')])).toBe(true)
  })
  it('keeps the newest 8 and ignores other files', () => {
    const names = Array.from({ length: 10 }, (_, i) =>
      backupName(`2026-0${(i % 9) + 1}-01`),
    ).concat('nk_defs.json')
    const sorted = [...new Set(names.filter((n) => n.startsWith('nk_backup_')))].sort()
    const drop = backupsToDelete(sorted)
    expect(drop).toEqual(sorted.slice(0, sorted.length - 8).reverse())
    expect(drop).not.toContain('nk_defs.json')
    expect(backupsToDelete(['nk_backup_2026-01-04.json'])).toEqual([])
  })
})

describe('entriesToCsv', () => {
  const e = (over: Partial<Entry>): Entry => ({
    id: '1',
    type: 'meal',
    dateKey: '2026-11-02',
    start: '2026-11-02T12:00:00.000+07:00',
    end: null,
    categoryId: 'cat-lunch',
    title: 'Cơm, "gà"',
    value: 1.5,
    unit: 'phần',
    rating: null,
    tags: ['a', 'b'],
    photoIds: ['p'],
    payload: { place: 'office' },
    source: 'manual',
    note: 'dòng 1\ndòng 2',
    createdAt: '',
    updatedAt: '',
    deviceId: 'd',
    deleted: false,
    dirty: 0,
    ...over,
  })
  const cats: Category[] = [
    {
      id: 'cat-lunch',
      name: 'Ăn trưa',
      entryType: 'meal',
      color: '',
      icon: '',
      order: 1,
      archived: false,
    },
  ]
  it('quotes cells, resolves category names, skips deleted entries and photo ids', () => {
    const csv = entriesToCsv([e({}), e({ id: '2', deleted: true })], cats)
    const [head, row, tail] = csv.replace('﻿', '').split('\r\n')
    expect(head).toBe('dateKey,start,end,type,category,title,value,unit,rating,tags,note,payload')
    expect(row).toBe(
      '2026-11-02,2026-11-02T12:00:00.000+07:00,,meal,Ăn trưa,"Cơm, ""gà""",1.5,phần,,a;b,"dòng 1\ndòng 2","{""place"":""office""}"',
    )
    expect(tail).toBe('')
    expect(csv.startsWith('﻿')).toBe(true)
  })
})
