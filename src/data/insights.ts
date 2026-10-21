import { findCorrelations, lookback } from '../core/correlation'
import { addDays, toDateKey, toIso } from '../core/date'
import {
  applyFeedback,
  correlationCandidates,
  dailyPicks,
  emptyStore,
  lastShownBefore,
  markShown,
  mergeInsights,
  ruleCandidates,
  type Feedback,
} from '../core/insights'
import { allMetrics, createMetricContext } from '../core/metrics'
import { evaluateRules } from '../core/rules'
import type { InsightStore } from '../core/types'
import { db } from './db'
import { getDaysInRange, getDefs, getDeviceId, getEntriesInRange, getSettings } from './repository'

const HISTORY_DAYS = 180

export async function getInsightStore(): Promise<InsightStore> {
  const row = await db.insights.get('insights')
  if (!row) return emptyStore()
  const { items, weights, lastRunDate, experiments, claudeNotes } = row
  return {
    items,
    weights,
    lastRunDate,
    experiments: experiments ?? [],
    claudeNotes: claudeNotes ?? [],
  }
}

export async function saveInsightStore(store: InsightStore): Promise<void> {
  await db.insights.put({
    ...store,
    key: 'insights',
    updatedAt: toIso(),
    deviceId: await getDeviceId(),
    dirty: 1,
  })
}

/**
 * Runs the rule and correlation engines once per day (SPEC 8: "1 lần mỗi ngày khi mở app") and stores
 * the result. `force` reruns, for after the data or thresholds changed.
 */
export async function refreshInsights(force = false): Promise<InsightStore> {
  const settings = await getSettings()
  const today = toDateKey(Date.now(), settings.dayStartHour)
  const store = await getInsightStore()
  if (!force && store.lastRunDate === today) return store

  const { from, to } = lookback(today, HISTORY_DAYS)
  const [entries, days, defs] = await Promise.all([
    getEntriesInRange(addDays(from, -7), to),
    getDaysInRange(from, to),
    getDefs(),
  ])
  const ctx = createMetricContext({ entries, days, habits: defs.habits, settings })
  const metrics = allMetrics(defs.habits)

  const fired = evaluateRules({
    ctx,
    today,
    now: Date.now(),
    overrides: settings.ruleThresholds,
    lastShown: lastShownBefore(store, today),
  })
  const found = findCorrelations(ctx, metrics, { from, to })

  const now = toIso()
  let next = mergeInsights(
    store,
    [...ruleCandidates(fired), ...correlationCandidates(found, metrics)],
    today,
    now,
  )
  next = markShown(
    next,
    dailyPicks(next, today).map((i) => i.id),
    today,
  )
  await saveInsightStore(next)
  return next
}

export async function giveFeedback(id: string, action: Feedback): Promise<void> {
  const settings = await getSettings()
  const today = toDateKey(Date.now(), settings.dayStartHour)
  await saveInsightStore(applyFeedback(await getInsightStore(), id, action, today, toIso()))
}

export async function addClaudeNote(question: string, text: string): Promise<void> {
  const store = await getInsightStore()
  await saveInsightStore({
    ...store,
    claudeNotes: [
      { id: crypto.randomUUID(), createdAt: toIso(), question, text },
      ...store.claudeNotes,
    ],
  })
}

export async function deleteClaudeNote(id: string): Promise<void> {
  const store = await getInsightStore()
  await saveInsightStore({ ...store, claudeNotes: store.claudeNotes.filter((n) => n.id !== id) })
}
