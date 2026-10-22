import { addDays, dateKeyRange } from './date'
import { effect } from './correlation'
import type { MetricContext } from './metrics'
import type { Metric } from './metrics'
import { dayStatus } from './habits'
import type { Experiment, ExperimentResult, Habit, Insight, InsightStore } from './types'

export const EXPERIMENT_DAYS = 14
/** Fewest days done right (and baseline days) before a verdict is given. */
export const MIN_COMPLIANT_DAYS = 5

/** `corr:bedtime>energy:1` → parts. Null for rule insights, which have no outcome to measure. */
export function parseCorrelationKind(
  kind: string,
): { factorId: string; outcomeId: string; lag: 0 | 1 } | null {
  const m = /^corr:(.+)>(.+):([01])$/.exec(kind)
  return m ? { factorId: m[1]!, outcomeId: m[2]!, lag: Number(m[3]) as 0 | 1 } : null
}

/** "Thử đi ngủ trước 23h30 trong 5 ngày tới." → "đi ngủ trước 23h30". */
export function experimentTitle(action: string): string {
  return action
    .replace(/^Thử\s+/, '')
    .replace(/\s+trong 5 ngày tới\.?$/, '')
    .replace(/\.$/, '')
}

/** The experiment and the temporary habit that carries it. Null when the insight cannot be tested. */
export function createExperiment(
  insight: Insight,
  today: string,
  id: string,
): { experiment: Experiment; habit: Habit } | null {
  const parts = parseCorrelationKind(insight.kind)
  if (!parts || !insight.action) return null
  const title = experimentTitle(insight.action)
  const habit: Habit = {
    id: `habit-exp-${id}`,
    name: `Thử: ${title}`,
    direction: 'build',
    kind: 'check',
    target: { op: '>=', value: 1 },
    schedule: { kind: 'daily' },
    reminderTime: null,
    linkedRule: null,
    startDate: today,
    archived: false,
  }
  const experiment: Experiment = {
    id,
    insightId: insight.id,
    ...parts,
    title,
    habitId: habit.id,
    startDate: today,
    endDate: addDays(today, EXPERIMENT_DAYS - 1),
    status: 'running',
    result: null,
  }
  return { experiment, habit }
}

const present = (xs: (number | null)[]): number[] => xs.filter((v): v is number => v !== null)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/**
 * Compares the outcome on the days the habit was kept with the 14 days before the experiment. Only
 * days done right count (a skipped day says nothing about the change). With lag 1 the outcome is read
 * on the day after each day.
 */
export function evaluateExperiment(
  exp: Experiment,
  habit: Habit,
  outcome: Metric,
  ctx: MetricContext,
): ExperimentResult {
  const values = ctx.habitValues(habit)
  const range = dateKeyRange(exp.startDate, exp.endDate)
  const loggedDays = new Set(range.filter((d) => ctx.logged(d)))
  const compliant = range.filter((d) => dayStatus(habit, d, values, { loggedDays }) === 'met')
  const test = present(compliant.map((d) => outcome.compute(addDays(d, exp.lag), ctx)))
  const base = present(
    dateKeyRange(addDays(exp.startDate, -EXPERIMENT_DAYS), addDays(exp.startDate, -1)).map((d) =>
      outcome.compute(addDays(d, exp.lag), ctx),
    ),
  )
  const stat =
    test.length >= MIN_COMPLIANT_DAYS && base.length >= MIN_COMPLIANT_DAYS
      ? effect(base, test)
      : null
  const enough = test.length >= MIN_COMPLIANT_DAYS && base.length >= MIN_COMPLIANT_DAYS
  const verdict: ExperimentResult['verdict'] = !enough
    ? 'insufficient'
    : !stat || Math.abs(stat.d) < 0.5
      ? 'same'
      : stat.d > 0
        ? 'better'
        : 'worse'
  return {
    nTest: test.length,
    nBase: base.length,
    testMean: mean(test),
    baseMean: mean(base),
    d: stat?.d ?? null,
    verdict,
  }
}

export const isDue = (exp: Experiment, today: string) =>
  exp.status === 'running' && today > exp.endDate

export function patchExperiment(
  store: InsightStore,
  id: string,
  patch: Partial<Experiment>,
): InsightStore {
  return {
    ...store,
    experiments: store.experiments.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }
}

/** Sentence for the result card. */
export function describeResult(exp: Experiment, outcomeLabel: string, r: ExperimentResult): string {
  const fmt = (n: number | null) => (n === null ? '–' : n.toFixed(1).replace('.', ','))
  const head = `${outcomeLabel}${exp.lag === 1 ? ' ngày hôm sau' : ''}: ${fmt(r.testMean)} (${r.nTest} ngày làm đúng) so với ${fmt(r.baseMean)} (${r.nBase} ngày trước đó).`
  const tail = {
    better: 'Có vẻ có tác dụng.',
    worse: 'Có vẻ không tốt hơn, thậm chí tệ hơn.',
    same: 'Chưa thấy khác biệt rõ.',
    insufficient: `Chưa đủ dữ liệu: cần ít nhất ${MIN_COMPLIANT_DAYS} ngày làm đúng và ${MIN_COMPLIANT_DAYS} ngày trước đó có ghi.`,
  }[r.verdict]
  return `${head} ${tail}`
}
