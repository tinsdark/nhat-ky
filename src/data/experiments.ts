import { addDays, toDateKey, toIso } from '../core/date'
import { createExperiment, evaluateExperiment, isDue, patchExperiment } from '../core/experiments'
import { allMetrics, createMetricContext } from '../core/metrics'
import type { Insight } from '../core/types'
import { getInsightStore, saveInsightStore } from './insights'
import { upsertHabit } from './habits'
import { getDaysInRange, getDefs, getEntriesInRange, getSettings } from './repository'

const today = async () => toDateKey(Date.now(), (await getSettings()).dayStartHour)

/** "Thử": makes the temporary habit and the experiment, and takes the card off the daily list. */
export async function startExperiment(insight: Insight): Promise<boolean> {
  const t = await today()
  const made = createExperiment(insight, t, crypto.randomUUID())
  if (!made) return false
  await upsertHabit(made.habit)
  const store = await getInsightStore()
  const now = toIso()
  await saveInsightStore({
    ...store,
    experiments: [...store.experiments, made.experiment],
    items: store.items.map((i) =>
      i.id === insight.id ? { ...i, status: 'trying', updatedAt: now } : i,
    ),
  })
  return true
}

/** Finishes experiments whose 14 days are over: measures them and leaves the keep/drop question to the user. */
export async function settleExperiments(): Promise<void> {
  const t = await today()
  let store = await getInsightStore()
  const due = store.experiments.filter((e) => isDue(e, t))
  if (due.length === 0) return

  const earliest = due.map((e) => addDays(e.startDate, -14)).sort()[0]!
  const [entries, days, defs, settings] = await Promise.all([
    getEntriesInRange(earliest, addDays(t, 1)),
    getDaysInRange(earliest, addDays(t, 1)),
    getDefs(),
    getSettings(),
  ])
  const ctx = createMetricContext({ entries, days, habits: defs.habits, settings })
  const metrics = allMetrics(defs.habits)
  for (const exp of due) {
    const habit = defs.habits.find((h) => h.id === exp.habitId)
    const outcome = metrics.find((m) => m.id === exp.outcomeId)
    if (!habit || !outcome) continue
    store = patchExperiment(store, exp.id, {
      status: 'finished',
      result: evaluateExperiment(exp, habit, outcome, ctx),
    })
  }
  await saveInsightStore(store)
}

/** Keep the habit (drops the "Thử:" prefix) or drop it (archived). */
export async function decideExperiment(id: string, keep: boolean): Promise<void> {
  const store = await getInsightStore()
  const exp = store.experiments.find((e) => e.id === id)
  if (!exp) return
  const defs = await getDefs()
  const habit = defs.habits.find((h) => h.id === exp.habitId)
  if (habit)
    await upsertHabit(
      keep ? { ...habit, name: habit.name.replace(/^Thử:\s*/, '') } : { ...habit, archived: true },
    )
  const t = await today()
  const now = toIso()
  const next = patchExperiment(store, id, { status: keep ? 'kept' : 'dropped' })
  await saveInsightStore({
    ...next,
    items: next.items.map((i) =>
      i.id === exp.insightId
        ? { ...i, status: keep ? 'helpful' : 'hidden', hiddenUntil: addDays(t, 14), updatedAt: now }
        : i,
    ),
  })
}
