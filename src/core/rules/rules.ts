import { addDays, dateKeyRange, toHHmm, weekday } from '../date'
import { isMet, isScheduled, streaks } from '../habits'
import { getMetric, type MetricContext } from '../metrics'
import type { Habit } from '../types'

export interface RuleInput {
  ctx: MetricContext
  today: string
  now: number
  /** Thresholds after defaults and the user's overrides are merged. */
  p: Record<string, number>
}

export interface RuleHit {
  /** Unique per rule (and per habit for the streak rule); the cooldown key. */
  key: string
  text: string
}

export interface Rule {
  id: string
  label: string
  /** 1 (low) … 3 (high). */
  priority: 1 | 2 | 3
  /** Days the condition looks at, for display in settings. */
  windowDays: number
  /** Days to stay quiet after the rule fired. */
  cooldownDays: number
  /** Threshold name → default value. Every key is editable in Settings. */
  defaults: Record<string, number>
  /** Human labels for the thresholds, same keys as `defaults`. */
  params: Record<string, string>
  /** Thresholds that come from Settings (targets, budgets) and are edited there, not per rule. */
  settingsBacked?: string[]
  evaluate(input: RuleInput): RuleHit[]
}

// ---- helpers -----------------------------------------------------------------------------------

/** Hours as "5h20". */
export function fmtHM(hours: number): string {
  const total = Math.round(hours * 60)
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`
}

const num1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

function values(metricId: string, ctx: MetricContext, from: string, to: string): (number | null)[] {
  const m = getMetric(metricId)
  if (!m) throw new Error(`Unknown metric: ${metricId}`)
  return dateKeyRange(from, to).map((d) => m.compute(d, ctx))
}

const present = (xs: (number | null)[]): number[] => xs.filter((v): v is number => v !== null)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mean = (xs: number[]) => sum(xs) / xs.length

/** The 7 finished days before today: for "did it happen" rules that a half-lived today would distort. */
const completed7 = (today: string): [string, string] => [addDays(today, -7), addDays(today, -1)]
const last7 = (today: string): [string, string] => [addDays(today, -6), today]
const weekStart = (today: string) => addDays(today, -weekday(today))

/** Last `n` values ending today, or ending yesterday while today's night is not recorded yet. */
function recentNights(
  metricId: string,
  ctx: MetricContext,
  today: string,
  n: number,
): (number | null)[] {
  const todayValue = values(metricId, ctx, today, today)[0]!
  const end = todayValue === null ? addDays(today, -1) : today
  return values(metricId, ctx, addDays(end, -(n - 1)), end)
}

// ---- rules -------------------------------------------------------------------------------------

export const RULES: Rule[] = [
  {
    id: 'sleep_short',
    label: 'Thiếu ngủ liên tiếp',
    priority: 3,
    windowDays: 3,
    cooldownDays: 2,
    defaults: { hours: 6, nights: 3 },
    params: { hours: 'Ngủ dưới (giờ)', nights: 'Số đêm liền' },
    evaluate({ ctx, today, p }) {
      const v = recentNights('sleep_hours', ctx, today, p.nights!)
      const got = present(v)
      if (got.length < p.nights! || !got.every((h) => h < p.hours!)) return []
      return [
        {
          key: 'sleep_short',
          text: `${p.nights} đêm liền ngủ dưới ${p.hours}h (TB ${fmtHM(mean(got))}). Tối nay ưu tiên lên giường trước 23h.`,
        },
      ]
    },
  },
  {
    id: 'bedtime_irregular',
    label: 'Giờ ngủ thất thường',
    priority: 2,
    windowDays: 7,
    cooldownDays: 3,
    defaults: { minutes: 60 },
    params: { minutes: 'Lệch quá (phút)' },
    evaluate({ ctx, today, p }) {
      const sd = present(recentNights('bedtime_sd7', ctx, today, 1))[0]
      if (sd === undefined || sd * 60 <= p.minutes!) return []
      return [
        {
          key: 'bedtime_irregular',
          text: `Giờ ngủ tuần này lệch ±${Math.round(sd * 60)} phút. Chọn một giờ cố định và giữ 5 ngày.`,
        },
      ]
    },
  },
  {
    id: 'late_coffee',
    label: 'Cà phê muộn',
    priority: 2,
    windowDays: 7,
    cooldownDays: 3,
    defaults: { hour: 15, days: 3 },
    params: { hour: 'Muộn hơn (giờ)', days: 'Số ngày/tuần' },
    evaluate({ ctx, today, p }) {
      const n = present(values('last_coffee_time', ctx, ...last7(today))).filter(
        (h) => h >= p.hour!,
      ).length
      return n < p.days!
        ? []
        : [{ key: 'late_coffee', text: `${n} ngày tuần này uống cà phê sau ${p.hour}h.` }]
    },
  },
  {
    id: 'skip_breakfast',
    label: 'Bỏ bữa sáng',
    priority: 1,
    windowDays: 7,
    cooldownDays: 3,
    defaults: { days: 3 },
    params: { days: 'Số ngày/7' },
    evaluate({ ctx, today, p }) {
      const n = present(values('skipped_breakfast', ctx, ...completed7(today))).filter(
        (v) => v === 1,
      ).length
      return n < p.days! ? [] : [{ key: 'skip_breakfast', text: `Bỏ bữa sáng ${n}/7 ngày.` }]
    },
  },
  {
    id: 'late_eating',
    label: 'Ăn khuya',
    priority: 1,
    windowDays: 7,
    cooldownDays: 3,
    defaults: { days: 3 },
    params: { days: 'Số ngày/7' },
    evaluate({ ctx, today, p }) {
      const n = present(values('late_eating', ctx, ...completed7(today))).filter(
        (v) => v === 1,
      ).length
      return n < p.days! ? [] : [{ key: 'late_eating', text: `${n}/7 ngày có bữa sau 22h.` }]
    },
  },
  {
    id: 'low_exercise',
    label: 'Thiếu vận động',
    priority: 2,
    windowDays: 7,
    cooldownDays: 2,
    // `minutes` follows Settings.exerciseTargetMinPerWeek unless overridden (see resolveThresholds).
    defaults: { minutes: 150, minLoggedDays: 3 },
    params: { minutes: 'Mục tiêu (phút/tuần)', minLoggedDays: 'Cần ghi ít nhất (ngày)' },
    settingsBacked: ['minutes'],
    evaluate({ ctx, today, p }) {
      const v = present(values('exercise_min', ctx, ...last7(today)))
      if (v.length < p.minLoggedDays! || sum(v) >= p.minutes!) return []
      return [
        { key: 'low_exercise', text: `Tuần này vận động ${Math.round(sum(v))}/${p.minutes} phút.` },
      ]
    },
  },
  {
    id: 'deep_work_short',
    label: 'Deep work hụt',
    priority: 2,
    windowDays: 7,
    cooldownDays: 2,
    defaults: { budgetHours: 15, ratio: 0.7 },
    params: { budgetHours: 'Ngân sách tuần (giờ)', ratio: 'Báo khi dưới (tỷ lệ)' },
    settingsBacked: ['budgetHours'],
    evaluate({ ctx, today, p }) {
      const days = dateKeyRange(weekStart(today), today)
      const workDays = ctx.settings.workDays
      const elapsed = days.filter((d) => workDays.includes(weekday(d))).length
      if (elapsed < 2 || workDays.length === 0) return []
      const expected = (p.budgetHours! * elapsed) / workDays.length
      const actual = sum(present(values('deep_work_hours', ctx, days[0]!, today)))
      if (actual >= p.ratio! * expected) return []
      return [
        {
          key: 'deep_work_short',
          text: `Deep work tuần này mới ${num1(actual)}h, mốc đến hôm nay là ${num1(expected)}h.`,
        },
      ]
    },
  },
  {
    id: 'ba_short',
    label: 'Học BA hụt',
    priority: 1,
    windowDays: 7,
    cooldownDays: 3,
    defaults: { budgetHours: 4, ratio: 0.7 },
    params: { budgetHours: 'Ngân sách tuần (giờ)', ratio: 'Báo khi dưới (tỷ lệ)' },
    settingsBacked: ['budgetHours'],
    evaluate({ ctx, today, p }) {
      // Study time is not tied to work days, so the week is paced over all 7 days.
      const days = dateKeyRange(weekStart(today), today)
      if (days.length < 4) return []
      const expected = (p.budgetHours! * days.length) / 7
      const actual = sum(present(values('ba_hours', ctx, days[0]!, today)))
      if (actual >= p.ratio! * expected) return []
      return [
        {
          key: 'ba_short',
          text: `Học BA tuần này mới ${num1(actual)}h, mốc đến hôm nay là ${num1(expected)}h (ngân sách ${p.budgetHours}h/tuần).`,
        },
      ]
    },
  },
  {
    id: 'overtime_high',
    label: 'OT nhiều',
    priority: 2,
    windowDays: 7,
    cooldownDays: 3,
    defaults: { hours: 10 },
    params: { hours: 'Quá (giờ OT/tuần)' },
    evaluate({ ctx, today, p }) {
      const total = sum(present(values('overtime_hours', ctx, ...last7(today))))
      return total <= p.hours!
        ? []
        : [
            {
              key: 'overtime_high',
              text: `OT ${num1(total)}h trong 7 ngày qua (ngưỡng ${p.hours}h).`,
            },
          ]
    },
  },
  {
    id: 'social_over',
    label: 'Mạng xã hội vượt',
    priority: 1,
    windowDays: 7,
    cooldownDays: 3,
    defaults: { budgetHours: 7 },
    params: { budgetHours: 'Ngân sách tuần (giờ)' },
    settingsBacked: ['budgetHours'],
    evaluate({ ctx, today, p }) {
      const total = sum(present(values('social_hours', ctx, weekStart(today), today)))
      return total <= p.budgetHours!
        ? []
        : [
            {
              key: 'social_over',
              text: `Mạng xã hội ${num1(total)}h tuần này, vượt ngân sách ${p.budgetHours}h.`,
            },
          ]
    },
  },
  {
    id: 'habit_streak_at_risk',
    label: 'Streak sắp đứt',
    priority: 3,
    windowDays: 1,
    cooldownDays: 1,
    defaults: { hour: 21, minStreak: 5 },
    params: { hour: 'Nhắc từ (giờ)', minStreak: 'Streak tối thiểu' },
    evaluate({ ctx, today, now, p }) {
      if (
        Number(toHHmm(now).slice(0, 2)) < p.hour! &&
        Number(toHHmm(now).slice(0, 2)) >= ctx.settings.dayStartHour
      )
        return []
      const hits: RuleHit[] = []
      for (const h of ctx.habits as Habit[]) {
        if (h.archived || h.metricRule || h.direction === 'quit' || !isScheduled(h, today)) continue
        const vals = ctx.habitValues(h)
        const value = vals.get(today) ?? 0
        if (isMet(h, value)) continue
        const { current } = streaks(h, vals, today)
        if (current < p.minStreak!) continue
        const unit = h.schedule.kind === 'timesPerWeek' ? 'tuần' : 'ngày'
        const rest =
          h.kind === 'check'
            ? 'còn chưa tick'
            : `còn ${num1(Math.max(0, h.target.value - value))}${h.kind === 'duration' ? ' phút' : ''} nữa`
        hits.push({
          key: `habit_streak_at_risk:${h.id}`,
          text: `${h.name} đang streak ${current} ${unit}, ${rest}.`,
        })
      }
      return hits
    },
  },
  {
    id: 'low_water',
    label: 'Ít nước',
    priority: 1,
    windowDays: 3,
    cooldownDays: 2,
    defaults: { ml: 1500, days: 3 },
    params: { ml: 'Dưới (ml)', days: 'Số ngày liền' },
    evaluate({ ctx, today, p }) {
      const v = values('water_ml', ctx, addDays(today, -p.days!), addDays(today, -1))
      const got = present(v)
      if (got.length < p.days! || !got.every((x) => x < p.ml!)) return []
      return [
        {
          key: 'low_water',
          text: `${p.days} ngày liền uống dưới ${num1(p.ml! / 1000)} lít nước (TB ${num1(mean(got) / 1000)} lít).`,
        },
      ]
    },
  },
]
