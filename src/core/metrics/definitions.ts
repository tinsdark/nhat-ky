import { addDays, dateKeyRange, weekday } from '../date'
import { dayStatus, isScheduled } from '../habits'
import { isOvertime } from '../overtime'
import type { Entry, Habit } from '../types'
import { isAlcohol, isCoffee, isFood, slotIs } from './classify'
import {
  blockHours,
  clockHours,
  dayHours,
  hoursBetween,
  mean,
  nightHours,
  stdDev,
  type MetricContext,
} from './context'

export type MetricGroup = 'sleep' | 'food' | 'time' | 'body' | 'habit' | 'mind'

/** `compute` returns null when the day has no data for this metric; null is never the same as 0. */
export interface Metric {
  id: string
  label: string
  unit: string
  group: MetricGroup
  compute(dateKey: string, ctx: MetricContext): number | null
}

// ---- entry classifiers: see classify.ts ----

const work = (ctx: MetricContext, d: string) => ctx.entriesOf(d).filter((e) => e.type === 'work')
const sumHours = (es: Entry[]) => es.reduce((s, e) => s + blockHours(e), 0)

const firstStart = (es: Entry[]) => (es.length ? es[0]!.start : null)
const lastStart = (es: Entry[]) => (es.length ? es[es.length - 1]!.start : null)

/** Wraps a metric that is only meaningful when the day was logged. */
const whenLogged =
  (fn: (d: string, ctx: MetricContext) => number | null) => (d: string, ctx: MetricContext) =>
    ctx.logged(d) ? fn(d, ctx) : null

/** Hours from `time` to the bedtime of that day's night, or null when either is missing or negative. */
function hoursToBed(d: string, ctx: MetricContext, time: string | null): number | null {
  const night = ctx.nightSleep(d)
  if (!night || !time) return null
  const gap = hoursBetween(time, night.start)
  return gap >= 0 ? gap : null
}

/** Midpoint of the night as clock hours in [-12, 12): 02:45 → 2.75, 23:00 → -1. */
function midpoint(d: string, ctx: MetricContext): number | null {
  const night = ctx.nightSleep(d)
  if (!night) return null
  const mid = new Date(
    (new Date(night.start).getTime() + new Date(night.end!).getTime()) / 2,
  ).toISOString()
  const h = clockHours(mid)
  return h >= 12 ? h - 24 : h
}

const windowKeys = (d: string, days = 7) => dateKeyRange(addDays(d, -(days - 1)), d)

// ---- registry ----------------------------------------------------------------------------------

export const METRICS: Metric[] = [
  // Sleep
  {
    id: 'bedtime',
    label: 'Giờ đi ngủ',
    unit: 'giờ (sau 24 = qua nửa đêm)',
    group: 'sleep',
    compute: (d, ctx) => {
      const n = ctx.nightSleep(d)
      return n ? nightHours(n.start) : null
    },
  },
  {
    id: 'wake_time',
    label: 'Giờ dậy',
    unit: 'giờ',
    group: 'sleep',
    compute: (d, ctx) => {
      const n = ctx.nightSleep(d)
      return n ? clockHours(n.end!) : null
    },
  },
  {
    id: 'sleep_hours',
    label: 'Thời lượng ngủ',
    unit: 'giờ',
    group: 'sleep',
    compute: (d, ctx) => {
      const n = ctx.nightSleep(d)
      return n ? blockHours(n) : null
    },
  },
  {
    id: 'sleep_quality',
    label: 'Chất lượng ngủ',
    unit: '1–5',
    group: 'sleep',
    compute: (d, ctx) => {
      const q = ctx.nightSleep(d)?.payload.quality
      return typeof q === 'number' ? q : null
    },
  },
  {
    id: 'bedtime_sd7',
    label: 'Độ lệch giờ ngủ 7 ngày',
    unit: 'giờ',
    group: 'sleep',
    compute: (d, ctx) =>
      stdDev(
        windowKeys(d)
          .map((k) => ctx.nightSleep(k))
          .filter((n): n is Entry => n !== null)
          .map((n) => nightHours(n.start)),
      ),
  },
  {
    id: 'screen_before_bed',
    label: 'Màn hình trước ngủ',
    unit: '0/1',
    group: 'sleep',
    compute: (d, ctx) => {
      const v = ctx.nightSleep(d)?.payload.screenBeforeBed
      return typeof v === 'boolean' ? (v ? 1 : 0) : null
    },
  },
  {
    id: 'sleep_midpoint',
    label: 'Điểm giữa giấc ngủ',
    unit: 'giờ',
    group: 'sleep',
    compute: midpoint,
  },
  {
    id: 'social_jetlag',
    label: 'Lệch ngày thường / cuối tuần',
    unit: 'giờ',
    group: 'sleep',
    // Mean midpoint of nights before a free morning (the nights that start Fri and Sat, i.e. waking Sat–Sun)
    // minus the other nights (waking Mon–Fri), over the 7 days ending today.
    compute: (d, ctx) => {
      const free: number[] = []
      const busy: number[] = []
      for (const k of windowKeys(d)) {
        const m = midpoint(k, ctx)
        if (m === null) continue
        ;(weekday(k) === 4 || weekday(k) === 5 ? free : busy).push(m)
      }
      const f = mean(free)
      const b = mean(busy)
      return f === null || b === null ? null : f - b
    },
  },
  {
    id: 'outdoor_morning',
    label: 'Ra ngoài trời buổi sáng',
    unit: '0/1',
    group: 'sleep',
    compute: whenLogged((d, ctx) =>
      ctx
        .entriesOf(d)
        .some(
          (e) =>
            e.categoryId === 'cat-outdoor' &&
            clockHours(e.start) < 10 &&
            clockHours(e.start) >= ctx.settings.dayStartHour,
        )
        ? 1
        : 0,
    ),
  },

  // Food & drink
  {
    id: 'dinner_time',
    label: 'Giờ ăn tối',
    unit: 'giờ',
    group: 'food',
    compute: (d, ctx) => {
      const dinner = ctx.entriesOf(d).find((e) => isFood(e) && slotIs(e, 'dinner', 'cat-dinner'))
      return dinner ? dayHours(dinner.start, ctx.settings.dayStartHour) : null
    },
  },
  {
    id: 'late_eating',
    label: 'Ăn khuya',
    unit: '0/1',
    group: 'food',
    compute: whenLogged((d, ctx) =>
      ctx.entriesOf(d).some((e) => {
        if (!isFood(e)) return false
        const h = clockHours(e.start)
        return e.payload.mealSlot === 'late' || h >= 22 || h < ctx.settings.dayStartHour
      })
        ? 1
        : 0,
    ),
  },
  {
    id: 'coffee_count',
    label: 'Số ly cà phê',
    unit: 'ly',
    group: 'food',
    compute: whenLogged((d, ctx) => ctx.entriesOf(d).filter(isCoffee).length),
  },
  {
    id: 'last_coffee_time',
    label: 'Giờ ly cà phê cuối',
    unit: 'giờ',
    group: 'food',
    compute: (d, ctx) => {
      const last = lastStart(ctx.entriesOf(d).filter(isCoffee))
      return last ? dayHours(last, ctx.settings.dayStartHour) : null
    },
  },
  {
    id: 'water_ml',
    label: 'Nước uống',
    unit: 'ml',
    group: 'food',
    compute: whenLogged((d, ctx) =>
      ctx
        .entriesOf(d)
        .filter((e) => e.type === 'water')
        .reduce((s, e) => s + (e.value ?? 0), 0),
    ),
  },
  {
    id: 'skipped_breakfast',
    label: 'Bỏ bữa sáng',
    unit: '0/1',
    group: 'food',
    compute: whenLogged((d, ctx) =>
      ctx.entriesOf(d).some((e) => isFood(e) && slotIs(e, 'breakfast', 'cat-breakfast')) ? 0 : 1,
    ),
  },
  {
    id: 'healthy_score',
    label: 'Điểm healthy',
    unit: '1–3 (3 = nhiều rau)',
    group: 'food',
    // Meal quality is 1 = nhiều rau … 3 = dầu mỡ/ngọt; flipped so a higher score is healthier.
    compute: (d, ctx) =>
      mean(
        ctx
          .entriesOf(d)
          .filter(isFood)
          .map((e) => e.payload.quality)
          .filter((q): q is number => typeof q === 'number')
          .map((q) => 4 - q),
      ),
  },
  {
    id: 'alcohol',
    label: 'Rượu bia',
    unit: '0/1',
    group: 'food',
    compute: whenLogged((d, ctx) => (ctx.entriesOf(d).some(isAlcohol) ? 1 : 0)),
  },
  {
    id: 'eating_window',
    label: 'Khung ăn',
    unit: 'giờ',
    group: 'food',
    compute: (d, ctx) => {
      const food = ctx.entriesOf(d).filter(isFood)
      if (food.length < 2) return null
      return hoursBetween(food[0]!.start, food[food.length - 1]!.start)
    },
  },
  {
    id: 'last_meal_to_bed',
    label: 'Bữa cuối → ngủ',
    unit: 'giờ',
    group: 'food',
    compute: (d, ctx) => hoursToBed(d, ctx, lastStart(ctx.entriesOf(d).filter(isFood))),
  },
  {
    id: 'last_coffee_to_bed',
    label: 'Cà phê cuối → ngủ',
    unit: 'giờ',
    group: 'food',
    compute: (d, ctx) => hoursToBed(d, ctx, lastStart(ctx.entriesOf(d).filter(isCoffee))),
  },

  // Time
  {
    id: 'work_hours',
    label: 'Giờ làm',
    unit: 'giờ',
    group: 'time',
    compute: whenLogged((d, ctx) => sumHours(work(ctx, d))),
  },
  {
    id: 'deep_work_hours',
    label: 'Deep work',
    unit: 'giờ',
    group: 'time',
    compute: whenLogged((d, ctx) =>
      sumHours(work(ctx, d).filter((e) => e.categoryId === 'cat-deep')),
    ),
  },
  {
    id: 'focus_avg',
    label: 'Tập trung TB',
    unit: '1–5',
    group: 'time',
    compute: (d, ctx) =>
      mean(
        work(ctx, d)
          .map((e) => e.payload.focus)
          .filter((f): f is number => typeof f === 'number'),
      ),
  },
  {
    id: 'interruptions',
    label: 'Số lần bị ngắt',
    unit: 'lần',
    group: 'time',
    compute: (d, ctx) => {
      const w = work(ctx, d)
      return w.length === 0
        ? null
        : w.reduce((s, e) => s + (Number(e.payload.interruptions) || 0), 0)
    },
  },
  {
    id: 'overtime_hours',
    label: 'Giờ tăng ca',
    unit: 'giờ',
    group: 'time',
    compute: whenLogged((d, ctx) =>
      // Recomputed from the working hours in Settings, not read from the flag stored with the entry.
      sumHours(
        work(ctx, d).filter((e) => e.end !== null && isOvertime(e.start, e.end, ctx.settings)),
      ),
    ),
  },
  {
    id: 'ba_hours',
    label: 'Giờ học BA',
    unit: 'giờ',
    group: 'time',
    compute: whenLogged((d, ctx) =>
      sumHours(ctx.entriesOf(d).filter((e) => e.categoryId === 'cat-ba')),
    ),
  },
  {
    id: 'study_hours',
    label: 'Giờ học tập',
    unit: 'giờ',
    group: 'time',
    compute: whenLogged((d, ctx) => sumHours(ctx.entriesOf(d).filter((e) => e.type === 'study'))),
  },
  {
    id: 'social_hours',
    label: 'Giờ mạng xã hội',
    unit: 'giờ',
    group: 'time',
    compute: whenLogged((d, ctx) =>
      sumHours(ctx.entriesOf(d).filter((e) => e.categoryId === 'cat-social')),
    ),
  },
  {
    id: 'work_start_time',
    label: 'Giờ bắt đầu làm',
    unit: 'giờ',
    group: 'time',
    compute: (d, ctx) => {
      const first = firstStart(work(ctx, d))
      return first ? dayHours(first, ctx.settings.dayStartHour) : null
    },
  },
  {
    id: 'work_start_after_wake',
    label: 'Bắt đầu làm sau khi dậy',
    unit: 'giờ',
    group: 'time',
    // Wake-up of the previous night (it happens on the morning of `d`).
    compute: (d, ctx) => {
      const first = firstStart(work(ctx, d))
      const prev = ctx.nightSleep(addDays(d, -1))
      if (!first || !prev) return null
      const gap = hoursBetween(prev.end!, first)
      return gap >= 0 ? gap : null
    },
  },

  // Exercise
  {
    id: 'exercise_min',
    label: 'Phút vận động',
    unit: 'phút',
    group: 'body',
    compute: whenLogged((d, ctx) =>
      Math.round(
        ctx
          .entriesOf(d)
          .filter((e) => e.type === 'exercise')
          .reduce((s, e) => s + blockHours(e) * 60, 0),
      ),
    ),
  },
  {
    id: 'exercised',
    label: 'Có vận động',
    unit: '0/1',
    group: 'body',
    compute: whenLogged((d, ctx) => (ctx.entriesOf(d).some((e) => e.type === 'exercise') ? 1 : 0)),
  },

  // Habits
  {
    id: 'habit_rate',
    label: 'Tỷ lệ thói quen đạt',
    unit: '0–1',
    group: 'habit',
    compute: whenLogged((d, ctx) => {
      const due = ctx.habits.filter((h) => !h.archived && isScheduled(h, d))
      if (due.length === 0) return null
      const met = due.filter((h) => dayStatus(h, d, ctx.habitValues(h)) === 'met').length
      return met / due.length
    }),
  },

  // Subjective
  ...(['mood', 'energy', 'stress', 'focus'] as const).map((k): Metric => ({
    id: k,
    label: { mood: 'Tâm trạng', energy: 'Năng lượng', stress: 'Căng thẳng', focus: 'Tập trung' }[k],
    unit: '1–5',
    group: 'mind',
    compute: (d, ctx) => ctx.day(d)?.[k] ?? null,
  })),
  {
    id: 'day_score',
    label: 'Điểm ngày',
    unit: '1–10',
    group: 'mind',
    compute: (d, ctx) => ctx.day(d)?.dayScore ?? null,
  },
]

/** One 0/1 metric per habit (`habit:<id>`): null on days the habit is not scheduled or nothing was logged. */
export function habitMetrics(habits: Habit[]): Metric[] {
  return habits.map((h) => ({
    id: `habit:${h.id}`,
    label: h.name,
    unit: '0/1',
    group: 'habit' as const,
    compute: (d: string, ctx: MetricContext) => {
      if (!ctx.logged(d)) return null
      const s = dayStatus(h, d, ctx.habitValues(h))
      return s === 'off' || s === 'rest' ? null : s === 'met' ? 1 : 0
    },
  }))
}
