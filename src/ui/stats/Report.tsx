import { useState } from 'preact/hooks'
import { addDays, weekday } from '../../core/date'
import { dailyPicks } from '../../core/insights'
import { formatChange, formatMetric } from '../../core/stats'
import { weeklyReport } from '../../core/weeklyReport'
import { getInsightStore } from '../../data/insights'
import { useLive } from '../useLive'
import type { StatsData } from './shared'

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const dm = (k: string) => `${k.slice(8)}/${k.slice(5, 7)}`

/** SPEC 7.3: a one-page weekly summary to screenshot or print (the print button gives "Lưu thành PDF"). */
export function Report({ data }: { data: StatsData }) {
  const { ctx, today, defs, metrics } = data
  const [end, setEnd] = useState(today)
  const store = useLive(getInsightStore, [])
  const r = weeklyReport(ctx, end, defs.habits)
  const advice = store && end === today ? dailyPicks(store, today) : []
  const label = (id: string) => metrics.find((m) => m.id === id)

  return (
    <div class="report">
      <div class="datenav noprint">
        <button type="button" aria-label="Tuần trước" onClick={() => setEnd(addDays(end, -7))}>
          ◀
        </button>
        <strong>
          {dm(r.from)} – {dm(r.to)}
        </strong>
        <button
          type="button"
          aria-label="Tuần sau"
          disabled={end >= today}
          onClick={() => setEnd(addDays(end, 7) > today ? today : addDays(end, 7))}
        >
          ▶
        </button>
      </div>
      <button type="button" class="btn btn-primary noprint" onClick={() => window.print()}>
        In / Lưu thành PDF
      </button>

      <h2 class="sub print-title">
        Báo cáo tuần {dm(r.from)} – {dm(r.to)}
      </h2>
      <p class="muted">{r.loggedDays}/7 ngày có ghi chép.</p>

      <table class="grid left">
        <thead>
          <tr>
            <th>Chỉ số</th>
            <th>Tuần này</th>
            <th>Tuần trước</th>
            <th>Thay đổi</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => {
            const unit =
              row.mode === 'sum' ? (row.id === 'exercise_min' ? 'phút' : 'giờ') : row.unit
            const change = formatChange(row.id, unit, row.current, row.previous)
            return (
              <tr>
                <th>
                  {label(row.id)?.label ?? row.label}
                  {row.mode === 'sum' ? ' (tổng)' : ''}
                </th>
                <td>{formatMetric(row.id, unit, row.current)}</td>
                <td>{formatMetric(row.id, unit, row.previous)}</td>
                <td class={change ? `delta ${change.tone}` : undefined}>
                  {change ? change.text : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2 class="sub">Từng ngày</h2>
      <table class="grid">
        <thead>
          <tr>
            <th />
            {r.daily.map((d) => (
              <th>{DAYS[weekday(d.dateKey)]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Điểm</th>
            {r.daily.map((d) => (
              <td>{d.dayScore ?? '–'}</td>
            ))}
          </tr>
          <tr>
            <th>Ngủ (giờ)</th>
            {r.daily.map((d) => (
              <td>{d.sleepHours === null ? '–' : d.sleepHours.toFixed(1).replace('.', ',')}</td>
            ))}
          </tr>
          <tr>
            <th>Tâm trạng</th>
            {r.daily.map((d) => (
              <td>{d.mood ?? '–'}</td>
            ))}
          </tr>
        </tbody>
      </table>

      {r.habits.length > 0 && (
        <>
          <h2 class="sub">Thói quen</h2>
          <table class="grid left">
            <tbody>
              {r.habits.map((h) => (
                <tr>
                  <th>{h.name}</th>
                  <td>
                    {h.met}/{h.due}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {advice.length > 0 && (
        <>
          <h2 class="sub">Nhận xét nổi bật</h2>
          <ul class="plain">
            {advice.map((a) => (
              <li>{a.text}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
