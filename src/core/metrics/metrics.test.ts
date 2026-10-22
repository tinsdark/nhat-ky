import { describe, expect, it } from 'vitest'
import { atTime } from '../date'
import { DEFAULT_SETTINGS } from '../settings'
import type { Day, Entry, Habit } from '../types'
import { allMetrics, computeSeries, createMetricContext, getMetric, METRICS } from './index'

// Seven sample days, Mon 2026-11-02 … Sun 2026-11-08. Every expected number below was worked out by hand.
const MON = '2026-11-02'
const TUE = '2026-11-03'
const WED = '2026-11-04'
const THU = '2026-11-05'
const FRI = '2026-11-06'
const SAT = '2026-11-07'
const SUN = '2026-11-08'

let n = 0
function e(
  dateKey: string,
  type: Entry['type'],
  start: string,
  end: string | null,
  over: Partial<Entry> = {},
  /** Logical day `end` is read against, when it differs from the start day (a night's wake-up). */
  endDay = dateKey,
): Entry {
  return {
    id: `e${n++}`,
    type,
    dateKey,
    start: atTime(dateKey, start),
    end: end ? atTime(endDay, end) : null,
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
    createdAt: '',
    updatedAt: '',
    deviceId: 'd',
    deleted: false,
    dirty: 0,
    ...over,
  }
}
const cat = (categoryId: string, extra: Partial<Entry> = {}) => ({ categoryId, ...extra })

const entries: Entry[] = [
  // Nights (start on the dateKey; times before 04:00 land on the next calendar day)
  e(MON, 'sleep', '23:00', '06:30', { payload: { quality: 4, screenBeforeBed: true } }, TUE),
  e(TUE, 'sleep', '23:30', '06:30', { payload: { quality: 3, screenBeforeBed: false } }, WED),
  e(WED, 'sleep', '00:30', '07:30', { payload: { quality: 2 } }, THU),
  e(THU, 'sleep', '23:00', '06:00', { payload: { quality: 5 } }, FRI),
  e(SAT, 'sleep', '01:00', '09:00', { payload: { quality: 4 } }, SUN),
  e(SUN, 'sleep', '23:00', '06:00', {}, '2026-11-09'),
  e(SUN, 'sleep', '13:00', '13:30', { payload: { nap: true } }), // naps never count as the night

  // Monday: a full day
  e(MON, 'meal', '07:30', null, cat('cat-breakfast', { payload: { quality: 1 } })),
  e(MON, 'meal', '12:00', null, cat('cat-lunch', { payload: { quality: 2 } })),
  e(MON, 'meal', '19:00', null, cat('cat-dinner', { payload: { quality: 3 } })),
  e(MON, 'meal', '09:00', null, cat('cat-drink', { title: 'Cà phê' })),
  e(MON, 'meal', '15:30', null, cat('cat-drink', { title: 'Cà phê' })),
  e(MON, 'water', '10:00', null, { value: 250 }),
  e(MON, 'water', '13:00', null, { value: 250 }),
  e(MON, 'water', '16:00', null, { value: 250 }),
  e(MON, 'work', '09:00', '11:00', cat('cat-deep', { payload: { focus: 4, interruptions: 2 } })),
  e(MON, 'work', '13:00', '14:00', cat('cat-meeting')),
  e(MON, 'work', '20:00', '21:00', cat('cat-support', { payload: { isOvertime: true } })),
  e(MON, 'activity', '07:00', '07:10', cat('cat-outdoor')),
  e(MON, 'exercise', '18:00', '18:40'),
  e(MON, 'activity', '21:15', '22:00', cat('cat-ba')),
  e(MON, 'activity', '22:00', '22:30', cat('cat-social')),
  e(MON, 'habit', '08:00', null, { payload: { habitId: 'h1' } }),

  // Tuesday: no breakfast, late snack, nothing else
  e(TUE, 'meal', '12:30', null, cat('cat-lunch')),
  e(TUE, 'meal', '22:30', null, { payload: { mealSlot: 'late' } }),
  e(TUE, 'habit', '08:00', null, { payload: { habitId: 'h1' } }),

  // Wednesday: one work block, no focus recorded
  e(WED, 'work', '09:30', '10:30', cat('cat-deep')),

  // Thursday: dinner and a beer
  e(THU, 'meal', '19:30', null, cat('cat-dinner')),
  e(THU, 'meal', '20:30', null, cat('cat-drink', { payload: { drink: 'alcohol' } })),

  // Friday: nothing logged at all
]

const days: Day[] = [
  { dateKey: MON, mood: 4, energy: 3, stress: 2, focus: 5, dayScore: 8, deleted: false } as Day,
  {
    dateKey: TUE,
    mood: null,
    energy: null,
    stress: null,
    focus: null,
    dayScore: null,
    deleted: false,
  } as Day,
]

const habit = (id: string, schedule: Habit['schedule']): Habit => ({
  id,
  name: id,
  direction: 'build',
  kind: 'check',
  target: { op: '>=', value: 1 },
  schedule,
  reminderTime: null,
  linkedRule: null,
  startDate: MON,
  archived: false,
})
const habits = [habit('h1', { kind: 'daily' }), habit('h2', { kind: 'weekdays', days: [5, 6] })]

const ctx = createMetricContext({ entries, days, habits, settings: DEFAULT_SETTINGS })
const v = (id: string, d: string) => getMetric(id, habits)!.compute(d, ctx)

describe('sleep metrics', () => {
  it('bedtime keeps after-midnight times past 24', () => {
    expect([MON, TUE, WED, THU, SAT, SUN].map((d) => v('bedtime', d))).toEqual([
      23, 23.5, 24.5, 23, 25, 23,
    ])
  })
  it('wake time, duration, quality, screen', () => {
    expect(v('wake_time', MON)).toBe(6.5)
    expect(v('wake_time', WED)).toBe(7.5)
    expect([MON, TUE, WED, SAT].map((d) => v('sleep_hours', d))).toEqual([7.5, 7, 7, 8])
    expect(v('sleep_quality', THU)).toBe(5)
    expect(v('sleep_quality', SUN)).toBeNull()
    expect(v('screen_before_bed', MON)).toBe(1)
    expect(v('screen_before_bed', TUE)).toBe(0)
    expect(v('screen_before_bed', WED)).toBeNull()
  })
  it('the nap on Sunday is ignored', () => {
    expect(v('sleep_hours', SUN)).toBe(7)
  })
  it('bedtime SD over 7 days is the population SD of the nights present', () => {
    expect(v('bedtime_sd7', SUN)).toBeCloseTo(0.7993, 3)
    expect(v('bedtime_sd7', MON)).toBeNull() // fewer than 3 nights
  })
  it('midpoint and weekday/weekend gap', () => {
    expect(v('sleep_midpoint', MON)).toBeCloseTo(2.75)
    expect(v('sleep_midpoint', SAT)).toBeCloseTo(5)
    // weekend mean (5 + 2.5)/2 = 3.75, weekday mean (2.75 + 3 + 4 + 2.5)/4 = 3.0625
    expect(v('social_jetlag', SUN)).toBeCloseTo(0.6875)
    expect(v('social_jetlag', TUE)).toBeNull() // no weekend yet
  })
  it('morning outdoors: 1 / 0 / null', () => {
    expect(v('outdoor_morning', MON)).toBe(1)
    expect(v('outdoor_morning', TUE)).toBe(0)
    expect(v('outdoor_morning', FRI)).toBeNull()
  })
})

describe('food metrics', () => {
  it('dinner, late eating, skipped breakfast', () => {
    expect(v('dinner_time', MON)).toBe(19)
    expect(v('dinner_time', TUE)).toBeNull()
    expect(v('late_eating', MON)).toBe(0)
    expect(v('late_eating', TUE)).toBe(1)
    expect(v('skipped_breakfast', MON)).toBe(0)
    expect(v('skipped_breakfast', TUE)).toBe(1)
  })
  it('coffee count and last coffee', () => {
    expect(v('coffee_count', MON)).toBe(2)
    expect(v('coffee_count', TUE)).toBe(0)
    expect(v('last_coffee_time', MON)).toBe(15.5)
    expect(v('last_coffee_time', TUE)).toBeNull()
  })
  it('water: 0 on a logged day without water, null on an empty day', () => {
    expect(v('water_ml', MON)).toBe(750)
    expect(v('water_ml', TUE)).toBe(0)
    expect(v('water_ml', FRI)).toBeNull()
  })
  it('healthy score flips quality so 3 is best', () => {
    expect(v('healthy_score', MON)).toBe(2) // (3 + 2 + 1) / 3
    expect(v('healthy_score', TUE)).toBeNull()
  })
  it('alcohol', () => {
    expect(v('alcohol', THU)).toBe(1)
    expect(v('alcohol', MON)).toBe(0)
  })
  it('eating window ignores drinks and needs two meals', () => {
    expect(v('eating_window', MON)).toBe(11.5)
    expect(v('eating_window', TUE)).toBe(10)
    expect(v('eating_window', THU)).toBeNull()
  })
  it('last meal and last coffee to bedtime', () => {
    expect(v('last_meal_to_bed', MON)).toBe(4)
    expect(v('last_meal_to_bed', TUE)).toBe(1)
    expect(v('last_coffee_to_bed', MON)).toBe(7.5)
    expect(v('last_coffee_to_bed', TUE)).toBeNull()
    expect(v('last_meal_to_bed', FRI)).toBeNull()
  })
})

describe('study hours', () => {
  const sctx = createMetricContext({
    entries: [
      e(MON, 'study', '20:00', '21:30'),
      e(MON, 'study', '21:30', '22:00', { categoryId: 'cat-whatever' }),
      e(TUE, 'meal', '12:00', null),
    ],
    days: [],
    habits: [],
    settings: DEFAULT_SETTINGS,
  })
  it('sums every study block of the day, whatever its category; 0 on a logged day without one; null when nothing is logged', () => {
    const m = getMetric('study_hours')!
    expect(m.compute(MON, sctx)).toBe(2)
    expect(m.compute(TUE, sctx)).toBe(0)
    expect(m.compute(WED, sctx)).toBeNull()
    expect(m.group).toBe('time')
  })
})

describe('time metrics', () => {
  it('work, deep work, focus, interruptions, overtime', () => {
    expect(v('work_hours', MON)).toBe(4)
    expect(v('deep_work_hours', MON)).toBe(2)
    expect(v('focus_avg', MON)).toBe(4)
    expect(v('interruptions', MON)).toBe(2)
    expect(v('overtime_hours', MON)).toBe(1)
    expect(v('work_hours', TUE)).toBe(0)
    expect(v('focus_avg', TUE)).toBeNull()
    expect(v('interruptions', TUE)).toBeNull()
    expect(v('work_hours', FRI)).toBeNull()
  })
  it('BA and social hours', () => {
    expect(v('ba_hours', MON)).toBe(0.75)
    expect(v('social_hours', MON)).toBe(0.5)
  })
  it('start of work, and after waking up', () => {
    expect(v('work_start_time', MON)).toBe(9)
    expect(v('work_start_time', TUE)).toBeNull()
    // Wednesday 09:30 minus the wake-up of Tuesday's night (06:30)
    expect(v('work_start_after_wake', WED)).toBe(3)
    expect(v('work_start_after_wake', MON)).toBeNull() // no night before Monday
  })
})

describe('exercise, habits, subjective', () => {
  it('exercise', () => {
    expect(v('exercise_min', MON)).toBe(40)
    expect(v('exercised', MON)).toBe(1)
    expect(v('exercised', TUE)).toBe(0)
    expect(v('exercise_min', FRI)).toBeNull()
  })
  it('per-habit metric: 1 met, 0 missed, null when not scheduled', () => {
    expect(v('habit:h1', MON)).toBe(1)
    expect(v('habit:h1', WED)).toBe(0)
    expect(v('habit:h2', MON)).toBeNull()
    expect(v('habit:h2', SAT)).toBe(0)
  })
  it('habit metrics are null on a day with nothing logged, not 0 or 1', () => {
    expect(v('habit:h1', FRI)).toBeNull()
    expect(v('habit_rate', FRI)).toBeNull()
  })
  it('habit rate over habits due that day', () => {
    expect(v('habit_rate', MON)).toBe(1) // only h1 due
    expect(v('habit_rate', WED)).toBe(0)
    expect(v('habit_rate', SAT)).toBe(0) // h1 and h2 due, none met
  })
  it('subjective values come from the Day, null when unrated', () => {
    expect(v('mood', MON)).toBe(4)
    expect(v('day_score', MON)).toBe(8)
    expect(v('mood', TUE)).toBeNull()
    expect(v('mood', WED)).toBeNull()
  })
})

describe('registry', () => {
  it('has unique ids and every metric returns null for an empty day', () => {
    const ids = allMetrics(habits).map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    const empty = createMetricContext({
      entries: [],
      days: [],
      habits: [],
      settings: DEFAULT_SETTINGS,
    })
    for (const m of METRICS) expect(m.compute(FRI, empty), m.id).toBeNull()
  })
  it('computeSeries returns one point per day', () => {
    const s = computeSeries(getMetric('sleep_hours')!, ctx, MON, SUN)
    expect(s.map((p) => p.value)).toEqual([7.5, 7, 7, 7, null, 8, 7])
  })
})

describe('habits that follow a metric', () => {
  const auto = (id: string, metricRule: NonNullable<Habit['metricRule']>): Habit => ({
    ...habit(id, { kind: 'daily' }),
    metricRule,
  })
  const early = auto('early', { metricId: 'bedtime', op: '<=', value: 23.5 })
  const wake7 = auto('wake7', { metricId: 'wake_time', op: '<=', value: 7, previousNight: true })
  const c = createMetricContext({
    entries,
    days,
    habits: [early, wake7],
    settings: DEFAULT_SETTINGS,
  })

  it('1 on days the metric passes, 0 when it does not, absent when there is no value', () => {
    const v = c.habitValues(early)
    expect([MON, TUE, WED, THU, SAT, SUN].map((d) => v.get(d))).toEqual([1, 1, 0, 1, 0, 1])
    expect(v.has(FRI)).toBe(false)
  })
  it('previousNight reads the night before: waking at 07:30 after Wednesday makes Thursday a miss', () => {
    const v = c.habitValues(wake7)
    expect([TUE, WED, THU, FRI].map((d) => v.get(d))).toEqual([1, 1, 0, 1])
  })
  it('works as a normal habit metric', () => {
    expect(getMetric('habit:early', [early])!.compute(WED, c)).toBe(0)
    expect(getMetric('habit:early', [early])!.compute(MON, c)).toBe(1)
  })
})
