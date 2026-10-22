import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findCorrelations, weekdayFindings, lookback } from '../../src/core/correlation'
import { addDays, dateKeyRange, weekday } from '../../src/core/date'
import { defaultHabits } from '../../src/core/defaults'
import { createMetricContext, METRICS, getMetric } from '../../src/core/metrics'
import { evaluateRules } from '../../src/core/rules'
import { DEFAULT_SETTINGS } from '../../src/core/settings'
import { generatePersonaMonth, HYPOTHESES, OCT_2026 } from '../../src/dev/persona'

const OUT = 'docs/report/data'
const NOW = '2026-10-30T21:40:00+07:00'
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const sd = (xs: number[]) => {
  const m = mean(xs)
  return m === null || xs.length < 2 ? null : Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}
const r2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100)

function ctxOf(data: ReturnType<typeof generatePersonaMonth>) {
  return createMetricContext({
    entries: data.entries,
    days: data.days,
    habits: defaultHabits('2026-10-01'),
    settings: DEFAULT_SETTINGS,
  })
}

describe('report data', () => {
  const oct = generatePersonaMonth({ startKey: '2026-10-01', days: 30, scenario: OCT_2026, nowIso: NOW })
  const ctx = ctxOf(oct)
  const keys = dateKeyRange('2026-10-01', '2026-10-30')

  it('writes the daily table and metric summaries for October', () => {
    const metrics = Object.fromEntries(
      METRICS.map((m) => {
        const values = keys.map((k) => m.compute(k, ctx))
        const present = values.filter((v): v is number => v !== null)
        const wk = keys.map((k, i) => ({ k, v: values[i] ?? null })).filter((x) => x.v !== null)
        const weekdayVals = wk.filter((x) => weekday(x.k) < 5).map((x) => x.v as number)
        const weekendVals = wk.filter((x) => weekday(x.k) >= 5).map((x) => x.v as number)
        return [
          m.id,
          {
            label: m.label,
            unit: m.unit,
            group: m.group,
            values,
            n: present.length,
            mean: r2(mean(present)),
            sd: r2(sd(present)),
            min: present.length ? r2(Math.min(...present)) : null,
            max: present.length ? r2(Math.max(...present)) : null,
            weekdayMean: r2(mean(weekdayVals)),
            weekendMean: r2(mean(weekendVals)),
          },
        ]
      }),
    )
    const days = keys.map((k) => {
      const d = oct.days.find((x) => x.dateKey === k)
      return {
        dateKey: k,
        weekday: weekday(k),
        dayType: d?.dayType ?? null,
        mood: d?.mood ?? null,
        energy: d?.energy ?? null,
        stress: d?.stress ?? null,
        focus: d?.focus ?? null,
        dayScore: d?.dayScore ?? null,
        highlight: d?.highlight ?? '',
        entries: oct.entries.filter((e) => e.dateKey === k).length,
      }
    })
    const counts: Record<string, number> = {}
    for (const e of oct.entries) counts[e.type] = (counts[e.type] ?? 0) + 1
    writeFileSync(
      `${OUT}/october.json`,
      JSON.stringify({ keys, metrics, days, counts, entryTotal: oct.entries.length }, null, 1),
    )
    expect(Object.keys(metrics).length).toBeGreaterThan(25)
  })

  it('writes the findings of the engine at 30 days and at 150 days', () => {
    const outcomes = METRICS.filter((m) => ['day_score', 'mood', 'energy', 'focus', 'sleep_quality', 'deep_work_hours'].includes(m.id))
    const f30 = findCorrelations(ctx, METRICS, lookback('2026-10-30', 30))
    const long = generatePersonaMonth({ startKey: '2026-05-04', days: 150, seed: 7 })
    const lctx = ctxOf(long)
    const end = addDays('2026-05-04', 149)
    const f150 = findCorrelations(lctx, METRICS, lookback(end, 150))
    const wk150 = weekdayFindings(lctx, outcomes, lookback(end, 150))
    const label = (id: string) => getMetric(id)?.label ?? id
    const shape = (fs: typeof f30) =>
      fs.map((f) => ({
        factor: label(f.factorId),
        outcome: label(f.outcomeId),
        lag: f.lag,
        kind: f.kind,
        nLow: f.nLow,
        nHigh: f.nHigh,
        meanLow: r2(f.meanLow),
        meanHigh: r2(f.meanHigh),
        d: r2(f.d),
        t: r2(f.t),
        confidence: f.confidence,
        alsoSeen: f.alsoSeen.map(label),
      }))
    // Same 150 days with weekends marked as 'holiday' (the engine skips those), to test the weekday/weekend confound.
    const wdOnly = {
      entries: long.entries,
      days: long.days.map((d) => (weekday(d.dateKey) >= 5 ? { ...d, dayType: 'holiday' as const } : d)),
    }
    const f150wd = findCorrelations(ctxOf(wdOnly), METRICS, lookback(end, 150))
    writeFileSync(
      `${OUT}/findings.json`,
      JSON.stringify(
        {
          days30: shape(f30),
          days150: shape(f150),
          days150Workdays: shape(f150wd),
          weekday150: wk150.map((w) => ({ ...w })),
        },
        null,
        1,
      ),
    )
    expect(Array.isArray(f150)).toBe(true)
  })

  it('writes the rules fired on 30/10 and the hypothesis recovery table', () => {
    const fired = evaluateRules({ ctx, today: '2026-10-30', now: Date.parse(NOW) })
    const long = generatePersonaMonth({ startKey: '2025-09-01', days: 400, seed: 11 })
    const lctx = ctxOf(long)
    const lk = dateKeyRange('2025-09-01', addDays('2025-09-01', 399))
    const val = (id: string, k: string) => getMetric(id)!.compute(k, lctx)
    const norm = (h: number) => (h < 12 ? h + 24 : h)
    const diff = (cond: (k: string) => boolean | null, f: (k: string) => number | null) => {
      const a: number[] = []
      const b: number[] = []
      for (const k of lk) {
        const c = cond(k)
        const v = f(k)
        if (c === null || v === null) continue
        ;(c ? a : b).push(v)
      }
      return { diff: r2((mean(a) ?? NaN) - (mean(b) ?? NaN)), nYes: a.length, nNo: b.length }
    }
    const dayRow = (k: string) => long.days.find((d) => d.dateKey === k)
    const rows = [
      {
        id: 'H1',
        measure: 'Giờ ngủ T7/CN trừ giờ ngủ T2–T6 (giờ)',
        expected: '≈ +0,9',
        ...diff((k) => weekday(k) >= 5, (k) => { const v = val('bedtime', k); return v === null ? null : norm(v) }),
      },
      {
        id: 'H2',
        measure: 'Chất lượng ngủ: có cà phê sau 15:00 trừ không có (điểm)',
        expected: '≈ −0,8',
        ...diff((k) => { const c = val('last_coffee_time', k); return c === null ? false : c >= 15 }, (k) => val('sleep_quality', k)),
      },
      {
        id: 'H3',
        measure: 'Chất lượng ngủ: dùng màn hình trước ngủ trừ không dùng (điểm)',
        expected: '≈ −0,6',
        ...diff((k) => { const v = val('screen_before_bed', k); return v === null ? null : v > 0 }, (k) => val('sleep_quality', k)),
      },
      {
        id: 'H4',
        measure: 'Chất lượng ngủ: ăn tối cách giờ ngủ dưới 2,5 giờ trừ còn lại (điểm)',
        expected: '≈ −0,5',
        ...diff((k) => { const v = val('last_meal_to_bed', k); return v === null ? null : v < 2.5 }, (k) => val('sleep_quality', k)),
      },
      {
        id: 'H5',
        measure: 'Chất lượng ngủ: ngày căng thẳng ≥ 4 trừ còn lại (điểm)',
        expected: '≈ −0,7',
        ...diff((k) => { const s = dayRow(k)?.stress; return s == null ? null : s >= 4 }, (k) => val('sleep_quality', k)),
      },
      {
        id: 'H6',
        measure: 'Chất lượng ngủ: ngày có vận động trừ không (điểm)',
        expected: '≈ +0,4',
        ...diff((k) => { const v = val('exercise_min', k); return v === null ? null : v > 0 }, (k) => val('sleep_quality', k)),
      },
      {
        id: 'H10',
        measure: 'Giờ ngủ đêm trước: ngày bỏ bữa sáng trừ ngày có ăn sáng (giờ)',
        expected: 'âm (ngủ ít thì dễ bỏ sáng)',
        ...diff((k) => { const v = val('skipped_breakfast', k); return v === null ? null : v > 0 }, (k) => val('sleep_hours', addDays(k, -1))),
      },
      {
        id: 'H11',
        measure: 'Căng thẳng: ngày có cà phê sau 15:00 trừ không (điểm)',
        expected: 'dương',
        ...diff((k) => { const c = val('last_coffee_time', k); return c === null ? false : c >= 15 }, (k) => dayRow(k)?.stress ?? null),
      },
      {
        id: 'H12',
        measure: 'Tập trung TB: sau đêm ngủ ngon (≥ 4) trừ sau đêm ngủ kém (điểm)',
        expected: 'dương',
        ...diff((k) => { const q = val('sleep_quality', addDays(k, -1)); return q === null ? null : q >= 4 }, (k) => val('focus_avg', k)),
      },
      {
        id: 'H17',
        measure: 'Giờ mạng xã hội: ngày căng thẳng ≥ 4 trừ còn lại (giờ)',
        expected: 'dương',
        ...diff((k) => { const s = dayRow(k)?.stress; return s == null ? null : s >= 4 }, (k) => val('social_hours', k)),
      },
    ]
    writeFileSync(
      `${OUT}/rules-and-recovery.json`,
      JSON.stringify(
        {
          fired,
          recovery: rows,
          hypotheses: HYPOTHESES,
          longDays: lk.length,
          longEntries: long.entries.length,
        },
        null,
        1,
      ),
    )
    expect(rows).toHaveLength(10)
  })
})
