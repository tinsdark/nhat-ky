import { useState } from 'preact/hooks'
import { addDays } from '../../core/date'
import { computeSeries, type Metric } from '../../core/metrics'
import { countLoggedDays, readiness } from '../../core/rules'
import { byWeekday, formatMetric, movingAverage, weekCompare } from '../../core/stats'
import { AdviceCards } from '../AdviceCards'
import { AskClaude } from '../AskClaude'
import { Experiments } from '../Experiments'
import { Correlations } from './Correlations'
import { MonthCalendar, TrendChart, WeekdayBars } from '../charts'
import type { StatsData } from './shared'

const TREND_DAYS = 90
const CARD_IDS = [
  'sleep_hours',
  'bedtime_sd7',
  'deep_work_hours',
  'exercise_min',
  'mood',
  'day_score',
  'sleep_midpoint',
]

export function Overview({ data }: { data: StatsData }) {
  const { ctx, today, metrics } = data
  const [trendA, setTrendA] = useState('sleep_hours')
  const [trendB, setTrendB] = useState('')
  const [viewId, setViewId] = useState('day_score')
  const [month, setMonth] = useState(today.slice(0, 7))

  const logged = countLoggedDays(ctx, today)
  const byId = new Map(metrics.map((m) => [m.id, m]))
  const get = (id: string) => byId.get(id)
  const trendFrom = addDays(today, -(TREND_DAYS - 1))

  const series = (id: string, color: string) => {
    const m = get(id)
    if (!m) return null
    const raw = computeSeries(m, ctx, trendFrom, today)
    return { raw, avg: movingAverage(raw, 7), color, label: m.label }
  }
  const trend = [
    series(trendA, 'var(--accent)'),
    trendB ? series(trendB, 'var(--warn)') : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null)

  const view = get(viewId)
  const monthEnd = `${month}-${String(lastDay(month)).padStart(2, '0')}`
  const monthPoints = view ? computeSeries(view, ctx, `${month}-01`, monthEnd) : []
  const weekdayValues = view ? byWeekday(computeSeries(view, ctx, trendFrom, today)) : []

  const select = (value: string, set: (v: string) => void, optional = false) => (
    <select value={value} onChange={(e) => set(e.currentTarget.value)}>
      {optional && <option value="">— không —</option>}
      {metrics.map((m) => (
        <option value={m.id}>{m.label}</option>
      ))}
    </select>
  )

  return (
    <div>
      <h2 class="sub">Tuần này so với tuần trước</h2>
      <div class="cards">
        {CARD_IDS.map((id) => get(id))
          .filter((m): m is Metric => !!m)
          .map((m) => {
            const w = weekCompare(m, ctx, today)
            const pct = w.changePct === null ? null : Math.round(w.changePct)
            const arrow = pct === null ? '' : pct > 0 ? '↑' : pct < 0 ? '↓' : '→'
            return (
              <div class="card">
                <span class="muted">{m.label}</span>
                <strong>{formatMetric(m.id, m.unit, w.current)}</strong>
                <span class="muted">
                  {pct === null ? 'chưa đủ dữ liệu' : `${arrow} ${Math.abs(pct ?? 0)}%`}
                </span>
              </div>
            )
          })}
      </div>

      <h2 class="sub">Lời khuyên nổi bật</h2>
      <AdviceCards
        emptyText={
          readiness(logged) === 'describe'
            ? `Cần thêm ${7 - logged} ngày ghi chép để có lời khuyên (đã có ${logged}/7).`
            : 'Hôm nay chưa có gì đáng nhắc.'
        }
      />

      <Experiments ctx={ctx} metrics={metrics} today={today} />

      <h2 class="sub">Cái gì đi kèm ngày tốt / ngày tệ</h2>
      <Correlations data={data} />

      <section class="panel">
        <div class="panel-head">
          <h2>Xu hướng 90 ngày</h2>
        </div>
        <div class="row">
          {select(trendA, setTrendA)}
          {select(trendB, setTrendB, true)}
        </div>
        <TrendChart series={trend} />
        <p class="muted legend">Chấm = từng ngày, đường = trung bình trượt 7 ngày.</p>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Theo chỉ số</h2>
        </div>
        {select(viewId, setViewId)}
        <div class="datenav">
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ◀
          </button>
          <strong>
            Tháng {month.slice(5)}/{month.slice(0, 4)}
          </strong>
          <button
            type="button"
            aria-label="Tháng sau"
            disabled={month >= today.slice(0, 7)}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ▶
          </button>
        </div>
        <MonthCalendar month={month} points={monthPoints} />
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Theo thứ trong tuần (90 ngày)</h2>
        </div>
        <WeekdayBars values={weekdayValues} />
      </section>

      <AskClaude ctx={ctx} metrics={metrics} today={today} />
    </div>
  )
}

function lastDay(month: string): number {
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()
}

function shiftMonth(month: string, delta: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}
