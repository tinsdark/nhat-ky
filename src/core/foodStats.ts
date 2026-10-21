import { addDays, dateKeyRange, toHHmm } from './date'
import { mainMeal, isCoffee, isFood, type MainSlot } from './metrics/classify'
import { clockHours, mean, type MetricContext } from './metrics/context'
import { getMetric } from './metrics'
import type { Entry } from './types'

export const MAIN_SLOTS: MainSlot[] = ['breakfast', 'lunch', 'dinner']

export interface MealCell {
  /** `unknown` = the day has nothing logged, so a missing meal says nothing. */
  status: 'ok' | 'missed' | 'unknown'
  time: string | null
}

export interface WeekMealRow {
  dateKey: string
  meals: Record<MainSlot, MealCell>
  /** Ate after 22:00 (shown red); null when the day is not logged. */
  late: boolean | null
}

const hhmm = toHHmm

/** The 7 days ending `endKey`: which main meals were eaten, and whether the day had a late meal. */
export function weekMealTable(ctx: MetricContext, endKey: string): WeekMealRow[] {
  const lateMetric = getMetric('late_eating')!
  return dateKeyRange(addDays(endKey, -6), endKey).map((dateKey) => {
    const logged = ctx.logged(dateKey)
    const entries = ctx.entriesOf(dateKey)
    const cell = (slot: MainSlot): MealCell => {
      const m = mainMeal(entries, slot)
      if (m) return { status: 'ok', time: hhmm(m.start) }
      return { status: logged ? 'missed' : 'unknown', time: null }
    }
    const late = lateMetric.compute(dateKey, ctx)
    return {
      dateKey,
      meals: { breakfast: cell('breakfast'), lunch: cell('lunch'), dinner: cell('dinner') },
      late: late === null ? null : late === 1,
    }
  })
}

export interface Food30 {
  loggedDays: number
  /** Mean clock hour of each main meal over the days it was eaten. */
  avgTime: Record<MainSlot, number | null>
  /** Logged days on which the main meal is missing. */
  skipped: Record<MainSlot, number>
  /** Share of meals with a known place that were eaten out or delivered. */
  eatingOutShare: number | null
  topDishes: { name: string; count: number }[]
  /** Mean first-to-last meal span, hours. */
  avgWindow: number | null
}

/** Last `days` days (default 30) ending today. */
export function food30(ctx: MetricContext, today: string, days = 30): Food30 {
  const keys = dateKeyRange(addDays(today, -(days - 1)), today)
  const times: Record<MainSlot, number[]> = { breakfast: [], lunch: [], dinner: [] }
  const skipped: Record<MainSlot, number> = { breakfast: 0, lunch: 0, dinner: 0 }
  const dishes = new Map<string, number>()
  let loggedDays = 0
  let withPlace = 0
  let out = 0
  const windows: number[] = []
  const windowMetric = getMetric('eating_window')!

  for (const d of keys) {
    if (!ctx.logged(d)) continue
    loggedDays++
    const entries = ctx.entriesOf(d)
    for (const slot of MAIN_SLOTS) {
      const m = mainMeal(entries, slot)
      if (m) times[slot].push(clockHours(m.start))
      else skipped[slot]++
    }
    for (const e of entries.filter(isFood)) {
      const place = e.payload.place
      if (typeof place === 'string') {
        withPlace++
        if (place === 'out' || place === 'delivery') out++
      }
      for (const name of dishNames(e)) dishes.set(name, (dishes.get(name) ?? 0) + 1)
    }
    const w = windowMetric.compute(d, ctx)
    if (w !== null) windows.push(w)
  }

  return {
    loggedDays,
    avgTime: {
      breakfast: mean(times.breakfast),
      lunch: mean(times.lunch),
      dinner: mean(times.dinner),
    },
    skipped,
    eatingOutShare: withPlace === 0 ? null : out / withPlace,
    topDishes: [...dishes.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    avgWindow: mean(windows),
  }
}

/** Dish names of a meal: the listed items, else its title. Case-insensitive grouping keeps the first spelling. */
function dishNames(e: Entry): string[] {
  const items = Array.isArray(e.payload.items)
    ? (e.payload.items as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  const names = items.length ? items : e.title.trim() ? [e.title.trim()] : []
  return names.map((n) => n.trim()).filter(Boolean)
}

export interface TodayFood {
  meals: { slot: MainSlot; done: boolean; time: string | null }[]
  waterMl: number
  waterTargetMl: number
  coffee: number
}

export function todayFood(ctx: MetricContext, today: string): TodayFood {
  const entries = ctx.entriesOf(today)
  return {
    meals: MAIN_SLOTS.map((slot) => {
      const m = mainMeal(entries, slot)
      return { slot, done: !!m, time: m ? hhmm(m.start) : null }
    }),
    waterMl: entries.filter((e) => e.type === 'water').reduce((s, e) => s + (e.value ?? 0), 0),
    waterTargetMl: ctx.settings.waterTargetMl,
    coffee: entries.filter(isCoffee).length,
  }
}
