// Dev-only generator of synthetic days with planted rules, for checking the analysis engine.
// Pure (no Dexie), so tests can use it directly.
import { addDays, atTime, dateKeyRange, toIso, weekday } from '../core/date'
import type { Day, Entry } from '../core/types'

export const FAKE_DEVICE = 'fake-data'

/** The two rules planted in the data; everything else is noise. */
export const PLANTED_RULES = [
  'Ngủ trước 23:30 → năng lượng hôm sau +1',
  'Cà phê sau 15:00 → chất lượng ngủ đêm đó −1',
] as const

/** Small deterministic PRNG (mulberry32) so a seed always yields the same data. */
export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(xs: T[]) => xs[Math.floor(next() * xs.length)]!,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export interface FakeData {
  entries: Entry[]
  days: Day[]
}

/** `days` logical days ending at `endKey` (default: yesterday is the caller's choice). */
export function generateFakeData(opts: { endKey: string; days: number; seed?: number }): FakeData {
  const r = rng(opts.seed ?? 42)
  const keys = dateKeyRange(addDays(opts.endKey, -(opts.days - 1)), opts.endKey)
  const entries: Entry[] = []
  const dayRows: Day[] = []
  let n = 0
  const now = atTime(opts.endKey, '23:00') // fixed, so equal seeds give identical data

  const add = (
    dateKey: string,
    type: Entry['type'],
    start: string,
    end: string | null,
    over: Partial<Entry> = {},
  ) =>
    entries.push({
      id: `fake-${opts.seed ?? 42}-${n++}`,
      type,
      dateKey,
      start,
      end,
      categoryId: '',
      title: '',
      value: null,
      unit: '',
      rating: null,
      tags: [],
      photoIds: [],
      payload: {},
      source: 'manual',
      note: '',
      createdAt: now,
      updatedAt: now,
      deviceId: FAKE_DEVICE,
      deleted: false,
      dirty: 0,
      ...over,
    })
  const at = (d: string, minutes: number) => atTime(d, hhmm(minutes))
  const span = (d: string, startMin: number, durMin: number) =>
    [at(d, startMin), at(d, startMin + durMin)] as const

  /** Energy of the day after an early night, decided when we generate that night. */
  const energyBoost = new Map<string, number>()

  for (const d of keys) {
    // --- the night starting today -------------------------------------------------------------
    const early = r.chance(0.5)
    const bedMin = early ? r.int(22 * 60 + 30, 23 * 60 + 25) : r.int(23 * 60 + 35, 24 * 60 + 59)
    const lateCoffee = r.chance(0.4)
    const quality = clamp(r.pick([3, 4]) - (lateCoffee ? 1 : 0), 1, 5)
    const bedIso = at(d, bedMin % 1440)
    const wakeIso = toIso(Date.parse(bedIso) + (7 * 60 + r.int(-20, 20)) * 60_000)
    add(d, 'sleep', bedIso, wakeIso, {
      categoryId: 'cat-sleep',
      title: 'Ngủ đêm',
      payload: { quality, screenBeforeBed: r.chance(0.5) },
    })
    if (early) energyBoost.set(addDays(d, 1), 1)

    // --- coffee -------------------------------------------------------------------------------
    const coffee = (min: number) =>
      add(d, 'meal', at(d, min), null, {
        categoryId: 'cat-drink',
        title: 'Cà phê',
        payload: { drink: 'coffee' },
      })
    if (lateCoffee) coffee(r.int(15 * 60 + 30, 16 * 60 + 59))
    else if (r.chance(0.7)) coffee(r.int(8 * 60 + 30, 10 * 60))

    // --- meals, water -------------------------------------------------------------------------
    if (r.chance(0.75))
      add(d, 'meal', at(d, r.int(7 * 60, 8 * 60 + 30)), null, {
        categoryId: 'cat-breakfast',
        title: 'Ăn sáng',
        payload: { quality: r.int(1, 3) },
      })
    add(d, 'meal', at(d, r.int(11 * 60 + 45, 13 * 60)), null, {
      categoryId: 'cat-lunch',
      title: 'Ăn trưa',
      payload: { quality: r.int(1, 3) },
    })
    add(d, 'meal', at(d, r.int(18 * 60 + 30, 20 * 60 + 30)), null, {
      categoryId: 'cat-dinner',
      title: 'Ăn tối',
      payload: { quality: r.int(1, 3) },
    })
    for (let i = r.int(5, 12); i > 0; i--)
      add(d, 'water', at(d, r.int(8 * 60, 21 * 60)), null, {
        categoryId: 'cat-water',
        value: 250,
        unit: 'ml',
      })

    // --- snack, energy check-ins, commute -----------------------------------------------------
    add(d, 'meal', at(d, r.int(15 * 60, 17 * 60)), null, {
      categoryId: 'cat-snack',
      title: 'Ăn vặt',
    })
    for (const min of [9 * 60 + 30, 12 * 60 + 30, 15 * 60 + 30, 19 * 60]) {
      add(d, 'note', at(d, min), null, {
        payload: { checkin: { energy: r.int(2, 4), mood: r.int(2, 5) } },
      })
    }
    if (weekday(d) < 5) {
      for (const min of [8 * 60, 17 * 60 + 40]) {
        const [s, e] = span(d, min, 25)
        add(d, 'activity', s, e, { categoryId: 'cat-commute', title: 'Di chuyển' })
      }
    }

    // --- work (weekdays), exercise, other activities ------------------------------------------
    if (weekday(d) < 5) {
      const [s, e] = span(d, 9 * 60, r.int(1, 4) * 60)
      add(d, 'work', s, e, {
        categoryId: 'cat-deep',
        title: 'Code',
        payload: { focus: r.int(2, 5), interruptions: r.int(0, 4) },
      })
      const [ms, me] = span(d, 14 * 60, 60)
      add(d, 'work', ms, me, { categoryId: 'cat-meeting', title: 'Họp' })
    }
    if (r.chance(0.3)) {
      const [s, e] = span(d, 18 * 60, r.int(30, 60))
      add(d, 'exercise', s, e, { categoryId: 'cat-exercise', title: 'Chạy bộ' })
    }
    if (r.chance(0.5)) {
      const [s, e] = span(d, 7 * 60, 15)
      add(d, 'activity', s, e, { categoryId: 'cat-outdoor', title: 'Ra ngoài trời' })
    }
    if (r.chance(0.3)) {
      const [s, e] = span(d, 21 * 60, r.int(30, 90))
      add(d, 'activity', s, e, { categoryId: 'cat-ba', title: 'Học BA' })
    }
    if (r.chance(0.5)) {
      const [s, e] = span(d, 20 * 60 + 30, r.int(15, 90))
      add(d, 'activity', s, e, { categoryId: 'cat-social', title: 'Lướt mạng' })
    }

    // --- subjective record (energy depends on last night) -------------------------------------
    dayRows.push({
      dateKey: d,
      mood: r.int(1, 5) as Day['mood'],
      energy: clamp(r.pick([3, 4]) + (energyBoost.get(d) ?? 0), 1, 5) as Day['energy'],
      stress: r.int(1, 5) as Day['stress'],
      focus: r.int(1, 5) as Day['focus'],
      dayScore: r.int(3, 9),
      highlight: '',
      dayType: null,
      note: '',
      createdAt: now,
      updatedAt: now,
      deviceId: FAKE_DEVICE,
      deleted: false,
      dirty: 0,
    })
  }
  return { entries, days: dayRows }
}
