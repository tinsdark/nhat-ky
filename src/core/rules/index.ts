import { addDays, dateKeyRange } from '../date'
import type { MetricContext } from '../metrics'
import type { Settings } from '../types'
import { RULES, type Rule } from './rules'

export { fmtHM, RULES } from './rules'
export type { Rule, RuleHit } from './rules'

/**
 * Defaults, then the user's overrides. Thresholds that Settings owns (exercise target, weekly time
 * budgets) always come from Settings, so there is one place to edit each.
 */
export function resolveThresholds(
  rule: Rule,
  overrides: Record<string, number> = {},
  settings?: Pick<Settings, 'exerciseTargetMinPerWeek' | 'weeklyBudgets'>,
): Record<string, number> {
  const base = { ...rule.defaults }
  if (settings) {
    if (rule.id === 'low_exercise') base.minutes = settings.exerciseTargetMinPerWeek
    if (rule.id === 'deep_work_short') base.budgetHours = settings.weeklyBudgets.deepWorkHours
    if (rule.id === 'ba_short') base.budgetHours = settings.weeklyBudgets.baHours
    if (rule.id === 'social_over') base.budgetHours = settings.weeklyBudgets.socialHours
  }
  const own: Record<string, number> = {}
  for (const k of Object.keys(base)) {
    if (rule.settingsBacked?.includes(k)) continue
    const v = overrides[`${rule.id}.${k}`]
    if (typeof v === 'number' && Number.isFinite(v)) own[k] = v
  }
  return { ...base, ...own }
}

export type Readiness = 'describe' | 'rules' | 'correlation' | 'lag'

/** How much the app may claim, by number of logged days (SPEC 8.1). */
export function readiness(loggedDays: number): Readiness {
  if (loggedDays < 7) return 'describe'
  if (loggedDays < 28) return 'rules'
  if (loggedDays < 60) return 'correlation'
  return 'lag'
}

export function countLoggedDays(ctx: MetricContext, today: string, lookbackDays = 365): number {
  return dateKeyRange(addDays(today, -(lookbackDays - 1)), today).filter((d) => ctx.logged(d))
    .length
}

export interface FiredRule {
  key: string
  ruleId: string
  label: string
  priority: 1 | 2 | 3
  text: string
}

/**
 * Runs every rule. `lastShown` maps a hit key to the dateKey it was last shown, to honour cooldowns.
 * Under 7 logged days nothing fires. Result is sorted by priority, highest first.
 */
export function evaluateRules(input: {
  ctx: MetricContext
  today: string
  now: number
  overrides?: Record<string, number>
  lastShown?: Record<string, string>
}): FiredRule[] {
  const { ctx, today, now, overrides, lastShown = {} } = input
  if (readiness(countLoggedDays(ctx, today)) === 'describe') return []
  const fired: FiredRule[] = []
  for (const rule of RULES) {
    if (ctx.settings.disabledRules?.includes(rule.id)) continue
    const p = resolveThresholds(rule, overrides, ctx.settings)
    for (const hit of rule.evaluate({ ctx, today, now, p })) {
      const last = lastShown[hit.key]
      if (last && dateKeyRange(last, today).length - 1 < rule.cooldownDays) continue
      fired.push({
        key: hit.key,
        ruleId: rule.id,
        label: rule.label,
        priority: rule.priority,
        text: hit.text,
      })
    }
  }
  return fired.sort((a, b) => b.priority - a.priority)
}
