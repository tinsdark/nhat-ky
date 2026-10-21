import { describe, expect, it } from 'vitest'
import { addDays, atTime } from '../date'
import { createMetricContext } from '../metrics'
import { DEFAULT_SETTINGS } from '../settings'
import type { Entry, Habit } from '../types'
import { evaluateRules, fmtHM, readiness, resolveThresholds, RULES } from './index'

// today = Saturday 2026-11-14; the week started Monday 2026-11-09.
const TODAY = '2026-11-14'
const NOW_MORNING = new Date('2026-11-14T10:00:00+07:00').getTime()
const NOW_NIGHT = new Date('2026-11-14T21:30:00+07:00').getTime()

let n = 0
function e(
  dateKey: string,
  type: Entry['type'],
  start: string,
  end: string | null,
  over: Partial<Entry> = {},
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

/** Fourteen logged days (a note each) so the engine is past the 7-day gate, plus `extra`. */
function ctxWith(extra: Entry[], habits: Habit[] = [], today = TODAY) {
  const base: Entry[] = []
  for (let i = 0; i < 14; i++) base.push(e(addDays(today, -i), 'note', '08:00', null))
  return createMetricContext({
    entries: [...base, ...extra],
    days: [],
    habits,
    settings: DEFAULT_SETTINGS,
  })
}

const night = (d: string, bed: string, wake: string, quality?: number) =>
  e(d, 'sleep', bed, wake, quality ? { payload: { quality } } : {}, addDays(d, 1))

const run = (
  extra: Entry[],
  opts: {
    habits?: Habit[]
    now?: number
    overrides?: Record<string, number>
    lastShown?: Record<string, string>
  } = {},
) =>
  evaluateRules({
    ctx: ctxWith(extra, opts.habits),
    today: TODAY,
    now: opts.now ?? NOW_MORNING,
    overrides: opts.overrides,
    lastShown: opts.lastShown,
  })
const ids = (r: ReturnType<typeof run>) => r.map((x) => x.ruleId)

describe('readiness / gate', () => {
  it('maps logged days to levels', () => {
    expect([0, 6, 7, 27, 28, 59, 60].map(readiness)).toEqual([
      'describe',
      'describe',
      'rules',
      'rules',
      'correlation',
      'correlation',
      'lag',
    ])
  })
  it('fires nothing under 7 logged days', () => {
    const ctx = createMetricContext({
      entries: [e('2026-11-13', 'sleep', '23:00', '04:00', {}, '2026-11-14')],
      days: [],
      habits: [],
      settings: DEFAULT_SETTINGS,
    })
    expect(evaluateRules({ ctx, today: TODAY, now: NOW_MORNING })).toEqual([])
  })
})

describe('sleep_short', () => {
  const short = [11, 12, 13].map((d) => night(`2026-11-${d}`, '00:00', '05:20')) // 5h20 each (00:00 is the next calendar day)
  it('fires after 3 short nights, today not yet recorded', () => {
    const hit = run(short).find((x) => x.ruleId === 'sleep_short')
    expect(hit?.text).toBe(
      '3 đêm liền ngủ dưới 6h (TB 5h20). Tối nay ưu tiên lên giường trước 23h.',
    )
  })
  it('does not fire when one night is long enough', () => {
    expect(ids(run([...short.slice(0, 2), night('2026-11-13', '23:00', '07:00')]))).not.toContain(
      'sleep_short',
    )
  })
  it('does not fire on a gap (null night)', () => {
    expect(ids(run([short[0]!, short[2]!]))).not.toContain('sleep_short')
  })
})

describe('bedtime_irregular', () => {
  it('fires when the 7-day SD of bedtime exceeds the threshold', () => {
    const nights = [
      ['08', '22:00'],
      ['09', '01:00'],
      ['10', '23:00'],
      ['11', '02:00'],
      ['12', '22:30'],
      ['13', '01:30'],
    ].map(([d, b]) => night(`2026-11-${d}`, b!, '08:00'))
    const hit = run(nights).find((x) => x.ruleId === 'bedtime_irregular')
    expect(hit?.text).toMatch(/^Giờ ngủ tuần này lệch ±\d+ phút/)
  })
  it('stays quiet for a steady bedtime', () => {
    const nights = [8, 9, 10, 11, 12, 13].map((d) =>
      night(`2026-11-${String(d).padStart(2, '0')}`, '23:00', '06:30'),
    )
    expect(ids(run(nights))).not.toContain('bedtime_irregular')
  })
})

describe('late_coffee / skip_breakfast / late_eating', () => {
  const coffee = (d: string, t: string) =>
    e(d, 'meal', t, null, { categoryId: 'cat-drink', title: 'Cà phê' })
  it('late coffee: 3 days after 15h fires, 2 does not', () => {
    const three = ['10', '11', '12'].map((d) => coffee(`2026-11-${d}`, '16:00'))
    expect(run(three).find((x) => x.ruleId === 'late_coffee')?.text).toBe(
      '3 ngày tuần này uống cà phê sau 15h.',
    )
    expect(ids(run(three.slice(0, 2)))).not.toContain('late_coffee')
  })
  it('skip breakfast counts finished days only', () => {
    // every finished day has a note entry (logged) and no breakfast → skipped 7/7
    expect(run([]).find((x) => x.ruleId === 'skip_breakfast')?.text).toBe('Bỏ bữa sáng 7/7 ngày.')
    const breakfasts = Array.from({ length: 7 }, (_, i) =>
      e(addDays(TODAY, -(i + 1)), 'meal', '07:30', null, { categoryId: 'cat-breakfast' }),
    )
    expect(ids(run(breakfasts))).not.toContain('skip_breakfast')
  })
  it('late eating', () => {
    const late = ['10', '11', '12', '13'].map((d) =>
      e(`2026-11-${d}`, 'meal', '22:30', null, { payload: { mealSlot: 'late' } }),
    )
    expect(run(late).find((x) => x.ruleId === 'late_eating')?.text).toBe('4/7 ngày có bữa sau 22h.')
  })
})

describe('low_exercise', () => {
  it('fires below the weekly target once 3 days are logged', () => {
    const ex = [e('2026-11-12', 'exercise', '18:00', '19:00')]
    expect(run(ex).find((x) => x.ruleId === 'low_exercise')?.text).toBe(
      'Tuần này vận động 60/150 phút.',
    )
  })
  it('does not fire when the target is met', () => {
    expect(ids(run([e('2026-11-12', 'exercise', '18:00', '20:40')]))).not.toContain('low_exercise')
  })
  it('follows the Settings target (the old per-rule override is ignored)', () => {
    const ex = [e('2026-11-12', 'exercise', '18:00', '19:00')]
    const entries = [
      ...Array.from({ length: 14 }, (_, i) => e(addDays(TODAY, -i), 'note', '08:00', null)),
      ...ex,
    ]
    const withTarget = (exerciseTargetMinPerWeek: number) =>
      evaluateRules({
        ctx: createMetricContext({
          entries,
          days: [],
          habits: [],
          settings: { ...DEFAULT_SETTINGS, exerciseTargetMinPerWeek },
        }),
        today: TODAY,
        now: NOW_MORNING,
        overrides: { 'low_exercise.minutes': 9999 },
      }).map((x) => x.ruleId)
    expect(withTarget(50)).not.toContain('low_exercise')
    expect(withTarget(150)).toContain('low_exercise')
  })
})

describe('deep_work_short / overtime_high / social_over', () => {
  it('deep work: Mon–Fri elapsed 5 of 5, budget 15h → expects 15h; 5h is under 70%', () => {
    // today is Saturday: elapsed work days = Mon..Fri = 5
    const w = [e('2026-11-10', 'work', '09:00', '14:00', { categoryId: 'cat-deep' })]
    expect(run(w).find((x) => x.ruleId === 'deep_work_short')?.text).toBe(
      'Deep work tuần này mới 5h, mốc đến hôm nay là 15h.',
    )
  })
  it('deep work: on target stays quiet', () => {
    const w = [e('2026-11-10', 'work', '08:00', '19:00', { categoryId: 'cat-deep' })] // 11h ≥ 0.7 × 15
    expect(ids(run(w))).not.toContain('deep_work_short')
  })
  it('overtime over 10h in 7 days', () => {
    const ot = [
      e('2026-11-10', 'work', '18:00', '23:00', { payload: { isOvertime: true } }),
      e('2026-11-11', 'work', '18:00', '24:00'.replace('24:00', '23:30'), {
        payload: { isOvertime: true },
      }),
    ]
    expect(run(ot).find((x) => x.ruleId === 'overtime_high')?.text).toBe(
      'OT 10,5h trong 7 ngày qua (ngưỡng 10h).',
    )
  })
  it('social over budget this week', () => {
    const s = [
      e('2026-11-10', 'activity', '20:00', '23:00', { categoryId: 'cat-social' }),
      e('2026-11-11', 'activity', '20:00', '23:00', { categoryId: 'cat-social' }),
      e('2026-11-12', 'activity', '20:00', '22:00', { categoryId: 'cat-social' }),
    ]
    expect(run(s).find((x) => x.ruleId === 'social_over')?.text).toBe(
      'Mạng xã hội 8h tuần này, vượt ngân sách 7h.',
    )
  })
})

describe('habit_streak_at_risk', () => {
  const read: Habit = {
    id: 'r',
    name: 'Đọc sách',
    direction: 'build',
    kind: 'duration',
    target: { op: '>=', value: 20 },
    schedule: { kind: 'daily' },
    reminderTime: null,
    linkedRule: null,
    startDate: '2026-11-01',
    archived: false,
  }
  const ticks = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) =>
      e(`2026-11-${String(from + i).padStart(2, '0')}`, 'habit', '21:00', null, {
        value: 20,
        payload: { habitId: 'r' },
      }),
    )
  it('fires after 21h when a streak of ≥5 is not yet kept today', () => {
    const hit = run(ticks(1, 13), { habits: [read], now: NOW_NIGHT }).find(
      (x) => x.ruleId === 'habit_streak_at_risk',
    )
    expect(hit?.text).toBe('Đọc sách đang streak 13 ngày, còn 20 phút nữa.')
  })
  it('is quiet before 21h, once met, or for a short streak', () => {
    expect(ids(run(ticks(1, 13), { habits: [read], now: NOW_MORNING }))).not.toContain(
      'habit_streak_at_risk',
    )
    expect(
      ids(
        run(
          [
            ...ticks(1, 13),
            e(TODAY, 'habit', '20:00', null, { value: 20, payload: { habitId: 'r' } }),
          ],
          { habits: [read], now: NOW_NIGHT },
        ),
      ),
    ).not.toContain('habit_streak_at_risk')
    expect(ids(run(ticks(11, 13), { habits: [read], now: NOW_NIGHT }))).not.toContain(
      'habit_streak_at_risk',
    )
  })
})

describe('low_water', () => {
  const water = (d: string, ml: number) => e(d, 'water', '10:00', null, { value: ml })
  it('3 finished days under 1.5 L', () => {
    const w = ['11', '12', '13'].map((d) => water(`2026-11-${d}`, 1200))
    expect(run(w).find((x) => x.ruleId === 'low_water')?.text).toBe(
      '3 ngày liền uống dưới 1,5 lít nước (TB 1,2 lít).',
    )
  })
  it('one good day breaks it', () => {
    const w = [water('2026-11-11', 1200), water('2026-11-12', 2000), water('2026-11-13', 1200)]
    expect(ids(run(w))).not.toContain('low_water')
  })
})

describe('engine', () => {
  it('sorts by priority and applies cooldown from lastShown', () => {
    const short = [11, 12, 13].map((d) => night(`2026-11-${d}`, '00:00', '05:20'))
    const all = run(short)
    expect(all[0]!.priority).toBe(3)
    expect(all.map((x) => x.priority)).toEqual(
      [...all.map((x) => x.priority)].sort((a, b) => b - a),
    )
    expect(ids(run(short, { lastShown: { sleep_short: '2026-11-13' } }))).not.toContain(
      'sleep_short',
    ) // cooldown 2d: 1 day ago
    expect(ids(run(short, { lastShown: { sleep_short: '2026-11-12' } }))).toContain('sleep_short') // 2 days ago
  })
  it('resolveThresholds: defaults, Settings target, overrides', () => {
    const rule = RULES.find((r) => r.id === 'low_exercise')!
    expect(resolveThresholds(rule).minutes).toBe(150)
    const st = { exerciseTargetMinPerWeek: 120, weeklyBudgets: DEFAULT_SETTINGS.weeklyBudgets }
    expect(resolveThresholds(rule, {}, st).minutes).toBe(120)
    // the exercise target is owned by Settings: a stale per-rule override is ignored
    expect(resolveThresholds(rule, { 'low_exercise.minutes': 90 }, st).minutes).toBe(120)
    expect(resolveThresholds(rule, { 'low_exercise.minLoggedDays': 5 }, st).minLoggedDays).toBe(5)
  })
  it('every rule has 1–3 priority, a cooldown, and labels for all its thresholds', () => {
    for (const r of RULES) {
      expect([1, 2, 3]).toContain(r.priority)
      expect(r.cooldownDays).toBeGreaterThan(0)
      expect(Object.keys(r.params).sort()).toEqual(Object.keys(r.defaults).sort())
    }
    expect(RULES).toHaveLength(12)
  })
  it('fmtHM', () => {
    expect(fmtHM(5.3333)).toBe('5h20')
    expect(fmtHM(7)).toBe('7h00')
  })
})

describe('ba_short and switches', () => {
  it('Học BA hụt: pace is budget × days elapsed / 7', () => {
    // Saturday: 6 days elapsed → expected 4 × 6/7 = 3.4h; 1h studied is under 70%
    const ba = [e('2026-11-10', 'activity', '21:00', '22:00', { categoryId: 'cat-ba' })]
    expect(run(ba).find((x) => x.ruleId === 'ba_short')?.text).toBe(
      'Học BA tuần này mới 1h, mốc đến hôm nay là 3,4h (ngân sách 4h/tuần).',
    )
    const enough = [e('2026-11-10', 'activity', '21:00', '23:30', { categoryId: 'cat-ba' })]
    expect(ids(run(enough))).not.toContain('ba_short')
  })
  it('a rule switched off in Settings does not fire; budgets come from Settings', () => {
    const entries = Array.from({ length: 14 }, (_, i) =>
      e(addDays(TODAY, -i), 'note', '08:00', null),
    )
    const ctx = (over: object) =>
      createMetricContext({
        entries,
        days: [],
        habits: [],
        settings: { ...DEFAULT_SETTINGS, ...over },
      })
    const fired = (c: ReturnType<typeof ctx>) =>
      evaluateRules({ ctx: c, today: TODAY, now: NOW_MORNING }).map((x) => x.ruleId)
    expect(fired(ctx({}))).toContain('skip_breakfast')
    expect(fired(ctx({ disabledRules: ['skip_breakfast'] }))).not.toContain('skip_breakfast')
    expect(
      fired(ctx({ weeklyBudgets: { deepWorkHours: 0, baHours: 0, socialHours: 7 } })),
    ).not.toContain('ba_short')
  })
})
