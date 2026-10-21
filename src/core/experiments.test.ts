import { describe, expect, it } from 'vitest'
import { addDays, atTime } from './date'
import {
  createExperiment,
  describeResult,
  evaluateExperiment,
  experimentTitle,
  isDue,
  parseCorrelationKind,
} from './experiments'
import { createMetricContext, getMetric } from './metrics'
import { DEFAULT_SETTINGS } from './settings'
import type { Day, Entry, Insight } from './types'

const insight = (over: Partial<Insight> = {}): Insight => ({
  id: 'corr:bedtime>energy:1',
  source: 'correlation',
  kind: 'corr:bedtime>energy:1',
  text: '',
  confidence: 'strong',
  status: 'new',
  hiddenUntil: null,
  action: 'Thử đi ngủ trước 23h30 trong 5 ngày tới.',
  score: 3,
  lastSeenDate: null,
  lastShownDate: null,
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('helpers', () => {
  it('parses correlation kinds and rejects rule kinds', () => {
    expect(parseCorrelationKind('corr:bedtime>energy:1')).toEqual({
      factorId: 'bedtime',
      outcomeId: 'energy',
      lag: 1,
    })
    expect(parseCorrelationKind('corr:habit:abc>mood:0')).toEqual({
      factorId: 'habit:abc',
      outcomeId: 'mood',
      lag: 0,
    })
    expect(parseCorrelationKind('rule:sleep_short')).toBeNull()
  })
  it('turns an action sentence into a short title', () => {
    expect(experimentTitle('Thử đi ngủ trước 23h30 trong 5 ngày tới.')).toBe('đi ngủ trước 23h30')
  })
  it('creates a 14-day experiment with a temporary habit, only for actionable correlations', () => {
    const r = createExperiment(insight(), '2026-11-02', 'x1')!
    expect(r.experiment).toMatchObject({
      startDate: '2026-11-02',
      endDate: '2026-11-15',
      status: 'running',
      lag: 1,
      habitId: 'habit-exp-x1',
    })
    expect(r.habit).toMatchObject({
      id: 'habit-exp-x1',
      name: 'Thử: đi ngủ trước 23h30',
      kind: 'check',
      startDate: '2026-11-02',
    })
    expect(createExperiment(insight({ action: null }), '2026-11-02', 'x')).toBeNull()
    expect(
      createExperiment(
        insight({ kind: 'rule:low_water', id: 'rule:low_water' }),
        '2026-11-02',
        'x',
      ),
    ).toBeNull()
  })
  it('is due the day after the window ends', () => {
    const { experiment } = createExperiment(insight(), '2026-11-02', 'x')!
    expect(isDue(experiment, '2026-11-15')).toBe(false)
    expect(isDue(experiment, '2026-11-16')).toBe(true)
    expect(isDue({ ...experiment, status: 'finished' }, '2026-11-20')).toBe(false)
  })
})

describe('evaluateExperiment', () => {
  const START = '2026-11-15'
  const { experiment, habit } = createExperiment(
    insight({ kind: 'corr:bedtime>energy:0', action: 'Thử đi ngủ trước 23h30 trong 5 ngày tới.' }),
    START,
    'x',
  )!
  const exp = { ...experiment, lag: 0 as const }
  const energy = getMetric('energy')!

  /** Baseline days 11-01..11-14 get `base` energy; test days 11-15..11-28 get `test`, habit ticked on `ticked` of them. */
  function build(base: number[], test: number[], ticked: number) {
    const days: Day[] = []
    const entries: Entry[] = []
    base.forEach((v, i) =>
      days.push({ dateKey: addDays('2026-11-01', i), energy: v, deleted: false } as Day),
    )
    test.forEach((v, i) =>
      days.push({ dateKey: addDays(START, i), energy: v, deleted: false } as Day),
    )
    for (let i = 0; i < ticked; i++) {
      const d = addDays(START, i)
      entries.push({
        id: `t${i}`,
        type: 'habit',
        dateKey: d,
        start: atTime(d, '22:00'),
        end: null,
        value: null,
        payload: { habitId: habit.id },
        deleted: false,
      } as unknown as Entry)
    }
    return createMetricContext({ entries, days, habits: [habit], settings: DEFAULT_SETTINGS })
  }
  const alt = (a: number, b: number, n: number) =>
    Array.from({ length: n }, (_, i) => (i % 2 ? a : b))

  it('better: higher energy on the days the habit was kept', () => {
    const r = evaluateExperiment(exp, habit, energy, build(alt(2, 3, 14), alt(4, 5, 14), 10))
    expect(r).toMatchObject({ nTest: 10, nBase: 14, verdict: 'better' })
    expect(r.testMean).toBeCloseTo(4.5)
    expect(r.baseMean).toBeCloseTo(2.5)
  })
  it('only counts days done right', () => {
    // 4 ticks: under the minimum, even though the other days look great
    expect(
      evaluateExperiment(exp, habit, energy, build(alt(2, 3, 14), alt(4, 5, 14), 4)).verdict,
    ).toBe('insufficient')
  })
  it('worse and same', () => {
    expect(
      evaluateExperiment(exp, habit, energy, build(alt(4, 5, 14), alt(2, 3, 14), 10)).verdict,
    ).toBe('worse')
    expect(
      evaluateExperiment(exp, habit, energy, build(alt(3, 4, 14), alt(3, 4, 14), 10)).verdict,
    ).toBe('same')
  })
  it('lag 1 reads the next day', () => {
    const lag1 = { ...exp, lag: 1 as const }
    const tick = (i: number) =>
      ({
        id: `t${i}`,
        type: 'habit',
        dateKey: addDays(START, i),
        start: atTime(addDays(START, i), '22:00'),
        end: null,
        value: null,
        payload: { habitId: habit.id },
        deleted: false,
      }) as unknown as Entry
    const baseline = Array.from(
      { length: 14 },
      (_, i) =>
        ({ dateKey: addDays('2026-11-02', i), energy: i % 2 ? 2 : 3, deleted: false }) as Day,
    )
    const nextDays = Array.from(
      { length: 8 },
      (_, i) => ({ dateKey: addDays(START, i + 1), energy: 5, deleted: false }) as Day,
    )
    const ctx = createMetricContext({
      entries: Array.from({ length: 8 }, (_, i) => tick(i)),
      days: [...baseline, ...nextDays],
      habits: [habit],
      settings: DEFAULT_SETTINGS,
    })
    expect(evaluateExperiment(lag1, habit, energy, ctx)).toMatchObject({
      nTest: 8,
      verdict: 'better',
    })
  })
  it('describeResult mentions counts and the verdict', () => {
    const text = describeResult(exp, 'Năng lượng', {
      nTest: 10,
      nBase: 14,
      testMean: 4.5,
      baseMean: 2.5,
      d: 3,
      verdict: 'better',
    })
    expect(text).toContain('4,5 (10 ngày làm đúng) so với 2,5 (14 ngày trước đó)')
    expect(text).toContain('Có vẻ có tác dụng')
  })
})
