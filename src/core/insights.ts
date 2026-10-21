import { addDays } from './date'
import type { Finding } from './correlation'
import type { Metric } from './metrics'
import type { FiredRule } from './rules'
import { formatMetric } from './stats'
import type { Insight, InsightStore, InsightStatus } from './types'

export const MAX_DAILY = 3
export const SNOOZE_DAYS = 14

export interface Candidate {
  kind: string
  source: Insight['source']
  text: string
  confidence: Insight['confidence']
  action: string | null
  score: number
}

export const emptyStore = (): InsightStore => ({
  items: [],
  weights: {},
  lastRunDate: null,
  experiments: [],
  claudeNotes: [],
})

/** Weight bucket of an insight: the rule, or the correlation factor (so "Không đúng" demotes the whole type). */
export function weightKey(kind: string): string {
  if (kind.startsWith('corr:')) return kind.split('>')[0]!
  return `rule:${kind.slice(5).split(':')[0]}`
}

// ---- candidates --------------------------------------------------------------------------------

/** Rules come ready-made with numbers; priority 1–3 is their score. */
export function ruleCandidates(fired: FiredRule[]): Candidate[] {
  return fired.map((f) => ({
    kind: `rule:${f.key}`,
    source: 'rule' as const,
    text: f.text,
    confidence: null,
    action: null,
    score: f.priority,
  }))
}

/**
 * Action to take for a factor, by whether the finding favours more (`hi`) or less (`lo`) of it.
 * Factors missing here are shown as information only and rank lower.
 */
const ACTIONS: Record<string, { hi?: string; lo?: string }> = {
  bedtime: { lo: 'Thử đi ngủ trước 23h30 trong 5 ngày tới.' },
  last_coffee_time: { lo: 'Thử không uống cà phê sau 15h trong 5 ngày tới.' },
  last_coffee_to_bed: {
    hi: 'Thử uống ly cà phê cuối sớm hơn, cách giờ ngủ ít nhất 8 tiếng, trong 5 ngày tới.',
  },
  coffee_count: { lo: 'Thử giảm còn 1 ly cà phê mỗi ngày trong 5 ngày tới.' },
  last_meal_to_bed: { hi: 'Thử ăn bữa cuối cách giờ ngủ ít nhất 3 tiếng trong 5 ngày tới.' },
  dinner_time: { lo: 'Thử ăn tối sớm hơn trong 5 ngày tới.' },
  late_eating: { lo: 'Thử không ăn sau 22h trong 5 ngày tới.' },
  alcohol: { lo: 'Thử bỏ rượu bia trong 5 ngày tới.' },
  skipped_breakfast: { lo: 'Thử ăn sáng đều trong 5 ngày tới.' },
  exercised: { hi: 'Thử vận động ít nhất 20 phút mỗi ngày trong 5 ngày tới.' },
  exercise_min: { hi: 'Thử tăng vận động thêm 10 phút mỗi ngày trong 5 ngày tới.' },
  outdoor_morning: { hi: 'Thử ra ngoài trời trước 10h sáng trong 5 ngày tới.' },
  screen_before_bed: { lo: 'Thử tắt màn hình 30 phút trước khi ngủ trong 5 ngày tới.' },
  water_ml: { hi: 'Thử uống đủ nước (2 lít) trong 5 ngày tới.' },
  social_hours: { lo: 'Thử giảm mạng xã hội còn một nửa trong 5 ngày tới.' },
}
/** Alias members of a cluster may hold the action even when another member is the label shown. */
const CONFIDENCE_LABEL = { weak: 'Yếu', medium: 'Vừa', strong: 'Mạnh' } as const
const CONFIDENCE_WEIGHT = { weak: 1, medium: 1.5, strong: 2 } as const

const fmt1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

function actionFor(f: Finding): string | null {
  const side = f.d > 0 ? 'hi' : 'lo'
  for (const id of [f.factorId, ...f.alsoSeen]) {
    const text = ACTIONS[id]?.[side]
    if (text) return text
  }
  return null
}

/** One sentence with the numbers, then (if there is one) what to try. SPEC 8.3/8.4. */
export function correlationCandidates(findings: Finding[], metrics: Metric[]): Candidate[] {
  const byId = new Map(metrics.map((m) => [m.id, m]))
  return findings.flatMap((f) => {
    const factor = byId.get(f.factorId)
    const outcome = byId.get(f.outcomeId)
    if (!factor || !outcome) return []
    const cond = (high: boolean) => {
      if (f.kind === 'binary') return `${factor.label} = ${high ? 'Có' : 'Không'}`
      return high
        ? `${factor.label} ≥ ${formatMetric(factor.id, factor.unit, f.highMin)}`
        : `${factor.label} ≤ ${formatMetric(factor.id, factor.unit, f.lowMax)}`
    }
    const better = f.d > 0 ? 'high' : 'low'
    const goodN = better === 'high' ? f.nHigh : f.nLow
    const badN = better === 'high' ? f.nLow : f.nHigh
    const goodMean = better === 'high' ? f.meanHigh : f.meanLow
    const badMean = better === 'high' ? f.meanLow : f.meanHigh
    const what = f.lag === 1 ? `${outcome.label} ngày hôm sau` : outcome.label
    const together = f.alsoSeen
      .map((id) => byId.get(id)?.label)
      .filter(Boolean)
      .join(', ')
    const action = actionFor(f)
    const text =
      `Khi ${cond(better === 'high')} (${goodN} ngày), ${what} TB ${fmt1(goodMean)}; ` +
      `khi ${cond(better !== 'high')} (${badN} ngày) TB ${fmt1(badMean)}. ` +
      `Độ tin cậy: ${CONFIDENCE_LABEL[f.confidence]}.` +
      (together ? ` Đi kèm: ${together}.` : '') +
      (action ? ` ${action}` : ' (Chỉ để tham khảo.)')
    const score = CONFIDENCE_WEIGHT[f.confidence] * Math.min(Math.abs(f.d), 2) * (action ? 1 : 0.3)
    return [
      {
        kind: `corr:${f.factorId}>${f.outcomeId}:${f.lag}`,
        source: 'correlation' as const,
        text,
        confidence: f.confidence,
        action,
        score,
      },
    ]
  })
}

// ---- store -------------------------------------------------------------------------------------

/**
 * Folds today's candidates into the store: new kinds become new insights, known kinds refresh text and
 * score but keep their status and feedback. A snooze that has run out resets to `new`.
 */
export function mergeInsights(
  store: InsightStore,
  candidates: Candidate[],
  today: string,
  now: string,
): InsightStore {
  const items = new Map(store.items.map((i) => [i.kind, i]))
  for (const c of candidates) {
    const cur = items.get(c.kind)
    if (!cur) {
      items.set(c.kind, {
        id: c.kind,
        source: c.source,
        kind: c.kind,
        text: c.text,
        confidence: c.confidence,
        action: c.action,
        status: 'new',
        hiddenUntil: null,
        score: c.score,
        lastSeenDate: today,
        lastShownDate: null,
        createdAt: now,
        updatedAt: now,
      })
      continue
    }
    const expired = cur.hiddenUntil !== null && cur.hiddenUntil <= today
    items.set(c.kind, {
      ...cur,
      text: c.text,
      confidence: c.confidence,
      action: c.action,
      score: c.score,
      lastSeenDate: today,
      status: expired && cur.status !== 'trying' ? 'new' : cur.status,
      hiddenUntil: expired ? null : cur.hiddenUntil,
      updatedAt: now,
    })
  }
  return { ...store, items: [...items.values()], lastRunDate: today }
}

export type Feedback = 'try' | 'helpful' | 'wrong' | 'hide'

const NEXT_STATUS: Record<Feedback, InsightStatus> = {
  try: 'trying',
  helpful: 'helpful',
  wrong: 'wrong',
  hide: 'hidden',
}

export function applyFeedback(
  store: InsightStore,
  id: string,
  action: Feedback,
  today: string,
  now: string,
): InsightStore {
  const item = store.items.find((i) => i.id === id)
  if (!item) return store
  const key = weightKey(item.kind)
  const current = store.weights[key] ?? 1
  const weights = { ...store.weights }
  if (action === 'wrong') weights[key] = Math.max(0.1, current * 0.5)
  if (action === 'helpful') weights[key] = Math.min(2, current * 1.25)
  const hiddenUntil = action === 'try' ? item.hiddenUntil : addDays(today, SNOOZE_DAYS)
  return {
    ...store,
    weights,
    items: store.items.map((i) =>
      i.id === id ? { ...i, status: NEXT_STATUS[action], hiddenUntil, updatedAt: now } : i,
    ),
  }
}

const isVisible = (i: Insight, today: string) =>
  i.status !== 'trying' && (i.hiddenUntil === null || i.hiddenUntil <= today)

/** Today's cards: produced today, not snoozed, best score (× feedback weight) first, at most 3. */
export function dailyPicks(store: InsightStore, today: string, max = MAX_DAILY): Insight[] {
  return store.items
    .filter((i) => i.lastSeenDate === today && isVisible(i, today))
    .map((i) => ({ i, rank: i.score * (store.weights[weightKey(i.kind)] ?? 1) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, max)
    .map((x) => x.i)
}

/** Records that these were on screen today (drives rule cooldowns). */
export function markShown(store: InsightStore, ids: string[], today: string): InsightStore {
  const set = new Set(ids)
  return {
    ...store,
    items: store.items.map((i) => (set.has(i.id) ? { ...i, lastShownDate: today } : i)),
  }
}

/** Last day each rule key was shown before today, for the rule engine's cooldown. */
export function lastShownBefore(store: InsightStore, today: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of store.items) {
    if (i.kind.startsWith('rule:') && i.lastShownDate && i.lastShownDate < today)
      out[i.kind.slice(5)] = i.lastShownDate
  }
  return out
}
