import { addDays, dateKeyRange, toIso, weekday } from './date'
import { blockHours, type MetricContext } from './metrics/context'
import type { Category, CategoryGroup, Entry } from './types'

export const GROUPS: { id: CategoryGroup; label: string }[] = [
  { id: 'work', label: 'Công việc chính' },
  { id: 'growth', label: 'Phát triển bản thân' },
  { id: 'personal', label: 'Cá nhân' },
]

export type GroupHours = Record<CategoryGroup, number>
const zero = (): GroupHours => ({ work: 0, growth: 0, personal: 0 })

/** Group of a work/activity entry; null for entries that are not time blocks (sleep, meals, water…). */
export function groupOfEntry(e: Entry, categories: Category[]): CategoryGroup | null {
  if (e.type !== 'work' && e.type !== 'activity') return null
  const cat = categories.find((c) => c.id === e.categoryId)
  if (cat?.group) return cat.group
  return e.type === 'work' || cat?.entryType === 'work' ? 'work' : 'personal'
}

export function hoursByGroup(
  ctx: MetricContext,
  categories: Category[],
  dateKey: string,
): GroupHours {
  const out = zero()
  for (const e of ctx.entriesOf(dateKey)) {
    const g = groupOfEntry(e, categories)
    if (g) out[g] += blockHours(e)
  }
  return out
}

/** Mean hours per group over the logged days of the last `days` days; null when nothing is logged. */
export function avgByGroup(
  ctx: MetricContext,
  categories: Category[],
  today: string,
  days = 30,
): GroupHours | null {
  const logged = dateKeyRange(addDays(today, -(days - 1)), today).filter((d) => ctx.logged(d))
  if (logged.length === 0) return null
  const sum = zero()
  for (const d of logged) {
    const h = hoursByGroup(ctx, categories, d)
    for (const g of GROUPS) sum[g.id] += h[g.id]
  }
  return {
    work: sum.work / logged.length,
    growth: sum.growth / logged.length,
    personal: sum.personal / logged.length,
  }
}

export interface WeekStackDay {
  dateKey: string
  hours: GroupHours
}

/** Seven days ending `today`, hours per group, and the week's deep work total. */
export function weekStack(ctx: MetricContext, categories: Category[], today: string) {
  const days: WeekStackDay[] = dateKeyRange(addDays(today, -6), today).map((dateKey) => ({
    dateKey,
    hours: hoursByGroup(ctx, categories, dateKey),
  }))
  const deepHours = days
    .flatMap((d) => ctx.entriesOf(d.dateKey))
    .filter((e) => e.type === 'work' && e.categoryId === 'cat-deep')
    .reduce((s, e) => s + blockHours(e), 0)
  return { days, deepHours }
}

export interface DeepHeatmap {
  /** [weekday Monday = 0][hour 0–23]: minutes of deep work in the period. */
  minutes: number[][]
  /** Same shape: focus average weighted by minutes, null where no focus was recorded. */
  focus: (number | null)[][]
}

const VN_OFFSET_MS = 7 * 3_600_000

/** When deep work happens, by weekday × clock hour (SPEC 4.3), over the last `days` days. */
export function deepHeatmap(ctx: MetricContext, today: string, days = 90): DeepHeatmap {
  const minutes = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  const focusSum = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  const focusMin = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const dateKey of dateKeyRange(addDays(today, -(days - 1)), today)) {
    for (const e of ctx.entriesOf(dateKey)) {
      if (e.type !== 'work' || e.categoryId !== 'cat-deep' || e.end === null) continue
      const end = new Date(e.end).getTime()
      const focus = typeof e.payload.focus === 'number' ? e.payload.focus : null
      for (let cur = new Date(e.start).getTime(); cur < end;) {
        const next = Math.min((Math.floor(cur / 3_600_000) + 1) * 3_600_000, end)
        const mins = (next - cur) / 60_000
        const local = new Date(cur + VN_OFFSET_MS)
        const wd = weekday(toIso(cur).slice(0, 10))
        const hr = local.getUTCHours()
        minutes[wd]![hr]! += mins
        if (focus !== null) {
          focusSum[wd]![hr]! += focus * mins
          focusMin[wd]![hr]! += mins
        }
        cur = next
      }
    }
  }
  const focus = focusSum.map((row, wd) =>
    row.map((s, h) => (focusMin[wd]![h]! > 0 ? s / focusMin[wd]![h]! : null)),
  )
  return { minutes, focus }
}

/** Hours per project name in a month (`YYYY-MM`), work blocks only; unnamed ones are "(chưa gán dự án)". */
export function byProject(ctx: MetricContext, month: string): { project: string; hours: number }[] {
  const totals = new Map<string, number>()
  for (const dateKey of ctx.dateKeys().filter((d) => d.startsWith(month))) {
    for (const e of ctx.entriesOf(dateKey)) {
      if (e.type !== 'work') continue
      const name =
        typeof e.payload.project === 'string' && e.payload.project.trim()
          ? e.payload.project.trim()
          : '(chưa gán dự án)'
      totals.set(name, (totals.get(name) ?? 0) + blockHours(e))
    }
  }
  return [...totals.entries()]
    .map(([project, hours]) => ({ project, hours }))
    .sort((a, b) => b.hours - a.hours)
}

export interface BudgetProgress {
  id: 'deep' | 'ba' | 'social'
  label: string
  hours: number
  budget: number
  /** `min`: reach it (deep work, BA); `max`: stay under it (social media). */
  kind: 'min' | 'max'
}

/** This week (Monday to today) against the weekly budgets in Settings (SPEC 4.4). */
export function budgetProgress(ctx: MetricContext, today: string): BudgetProgress[] {
  const start = addDays(today, -weekday(today))
  let deep = 0
  let ba = 0
  let social = 0
  for (const d of dateKeyRange(start, today)) {
    for (const e of ctx.entriesOf(d)) {
      const h = blockHours(e)
      if (e.type === 'work' && e.categoryId === 'cat-deep') deep += h
      if (e.categoryId === 'cat-ba') ba += h
      if (e.categoryId === 'cat-social') social += h
    }
  }
  const b = ctx.settings.weeklyBudgets
  return [
    { id: 'deep', label: 'Deep work', hours: deep, budget: b.deepWorkHours, kind: 'min' },
    { id: 'ba', label: 'Học BA', hours: ba, budget: b.baHours, kind: 'min' },
    { id: 'social', label: 'Mạng xã hội', hours: social, budget: b.socialHours, kind: 'max' },
  ]
}
