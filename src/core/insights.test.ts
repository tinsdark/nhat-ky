import { describe, expect, it } from 'vitest'
import type { Finding } from './correlation'
import {
  applyFeedback,
  correlationCandidates,
  dailyPicks,
  emptyStore,
  lastShownBefore,
  markShown,
  mergeInsights,
  ruleCandidates,
  weightKey,
} from './insights'
import { METRICS } from './metrics'

const NOW = '2026-11-02T10:00:00.000+07:00'
const finding = (over: Partial<Finding> = {}): Finding => ({
  factorId: 'bedtime',
  outcomeId: 'energy',
  lag: 1,
  kind: 'tertile',
  nLow: 19,
  nHigh: 19,
  meanLow: 4.4,
  meanHigh: 3.2,
  lowMax: 23.1,
  highMin: 24.2,
  d: -1.5,
  t: -5,
  confidence: 'strong',
  alsoSeen: ['wake_time'],
  ...over,
})

describe('correlationCandidates', () => {
  it('writes a sentence with both groups, their sizes, the confidence and an action', () => {
    const [c] = correlationCandidates([finding()], METRICS)
    expect(c!.kind).toBe('corr:bedtime>energy:1')
    expect(c!.text).toContain('Giờ đi ngủ ≤ 23:06 (19 ngày), Năng lượng ngày hôm sau TB 4,4')
    expect(c!.text).toContain('Giờ đi ngủ ≥ 00:12 (19 ngày) TB 3,2')
    expect(c!.text).toContain('Độ tin cậy: Mạnh')
    expect(c!.text).toContain('Đi kèm: Giờ dậy')
    expect(c!.text).toContain('Thử đi ngủ trước 23h30')
    expect(c!.score).toBeCloseTo(2 * 1.5)
  })
  it('binary factor uses Có / Không, and an action found via an alias member', () => {
    const [c] = correlationCandidates(
      [
        finding({
          factorId: 'wake_time',
          kind: 'binary',
          lowMax: null,
          highMin: null,
          alsoSeen: ['bedtime'],
        }),
      ],
      METRICS,
    )
    expect(c!.text).toContain('Giờ dậy = Không')
    expect(c!.text).toContain('Thử đi ngủ trước 23h30')
  })
  it('without an action it says so and ranks lower', () => {
    const withAction = correlationCandidates([finding()], METRICS)[0]!
    const info = correlationCandidates(
      [finding({ factorId: 'work_hours', alsoSeen: [] })],
      METRICS,
    )[0]!
    expect(info.text).toContain('Chỉ để tham khảo')
    expect(info.score).toBeLessThan(withAction.score)
  })
})

describe('store', () => {
  const cands = [
    ...ruleCandidates([
      { key: 'sleep_short', ruleId: 'sleep_short', label: 'x', priority: 3, text: 'Thiếu ngủ' },
    ]),
    ...ruleCandidates([
      { key: 'low_water', ruleId: 'low_water', label: 'x', priority: 1, text: 'Ít nước' },
    ]),
    ...correlationCandidates([finding()], METRICS),
  ]
  it('merge creates insights and keeps status across days', () => {
    let s = mergeInsights(emptyStore(), cands, '2026-11-02', NOW)
    expect(s.items).toHaveLength(3)
    expect(s.lastRunDate).toBe('2026-11-02')
    s = applyFeedback(s, 'rule:low_water', 'helpful', '2026-11-02', NOW)
    s = mergeInsights(s, cands, '2026-11-03', NOW)
    expect(s.items.find((i) => i.id === 'rule:low_water')!.status).toBe('helpful')
  })
  it('daily picks are today only, best first, max 3', () => {
    const s = mergeInsights(emptyStore(), cands, '2026-11-02', NOW)
    const picks = dailyPicks(s, '2026-11-02')
    expect(picks.map((p) => p.kind)).toEqual([
      'rule:sleep_short',
      'corr:bedtime>energy:1',
      'rule:low_water',
    ])
    expect(dailyPicks(s, '2026-11-03')).toEqual([]) // nothing produced that day
    expect(dailyPicks(s, '2026-11-02', 2)).toHaveLength(2)
  })
  it('hide snoozes for 14 days, then the card is back as new', () => {
    let s = mergeInsights(emptyStore(), cands, '2026-11-02', NOW)
    s = applyFeedback(s, 'rule:sleep_short', 'hide', '2026-11-02', NOW)
    expect(dailyPicks(s, '2026-11-02').map((p) => p.id)).not.toContain('rule:sleep_short')
    s = mergeInsights(s, cands, '2026-11-15', NOW)
    expect(dailyPicks(s, '2026-11-15').map((p) => p.id)).not.toContain('rule:sleep_short') // day 13
    s = mergeInsights(s, cands, '2026-11-16', NOW)
    const back = dailyPicks(s, '2026-11-16').find((p) => p.id === 'rule:sleep_short')
    expect(back?.status).toBe('new')
  })
  it('"Không đúng" halves the weight of the whole type and pushes it down the ranking', () => {
    let s = mergeInsights(emptyStore(), cands, '2026-11-02', NOW)
    s = applyFeedback(s, 'corr:bedtime>energy:1', 'wrong', '2026-11-02', NOW)
    expect(s.weights['corr:bedtime']).toBe(0.5)
    s = applyFeedback(s, 'rule:low_water', 'helpful', '2026-11-02', NOW)
    expect(s.weights['rule:low_water']).toBe(1.25)
    // a different outcome of the same factor starts demoted too
    expect(weightKey('corr:bedtime>mood:0')).toBe('corr:bedtime')
  })
  it('"Thử" removes the card from the daily list but keeps the insight', () => {
    let s = mergeInsights(emptyStore(), cands, '2026-11-02', NOW)
    s = applyFeedback(s, 'corr:bedtime>energy:1', 'try', '2026-11-02', NOW)
    expect(s.items.find((i) => i.id === 'corr:bedtime>energy:1')!.status).toBe('trying')
    expect(dailyPicks(s, '2026-11-02').map((p) => p.id)).not.toContain('corr:bedtime>energy:1')
  })
  it('lastShownBefore only reports rule keys shown on an earlier day', () => {
    let s = mergeInsights(emptyStore(), cands, '2026-11-02', NOW)
    s = markShown(s, ['rule:sleep_short'], '2026-11-02')
    expect(lastShownBefore(s, '2026-11-02')).toEqual({})
    expect(lastShownBefore(s, '2026-11-03')).toEqual({ sleep_short: '2026-11-02' })
  })
  it('weightKey buckets habit-streak rules together', () => {
    expect(weightKey('rule:habit_streak_at_risk:abc')).toBe('rule:habit_streak_at_risk')
  })
})
