import { useState } from 'preact/hooks'
import { addDays, addMonths } from '../../core/date'
import { computeSeries, getMetric } from '../../core/metrics'
import { energyCurve, energyHighlights, healthWeek, sleepBars } from '../../core/healthStats'
import { formatChange, formatMetric, labelWithScale } from '../../core/stats'
import { EnergyLine, MonthCalendar, SleepChart } from '../charts'
import type { StatsData } from './shared'
import { Icon } from '../Icon'

const DAYS_SHOWN = 30

/** SPEC 5.4 (sleep chart, calendar, weekly summary) and 5.5 (energy through the day). */
export function Health({ data }: { data: StatsData }) {
  const { ctx, today } = data
  const [month, setMonth] = useState(today.slice(0, 7))
  const from = addDays(today, -(DAYS_SHOWN - 1))
  const bars = sleepBars(ctx, from, today)
  const cards = healthWeek(ctx, today)
  const curve = energyCurve(ctx, today)
  const hi = energyHighlights(curve)
  const score = getMetric('day_score')!
  const monthEnd = `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`
  const points = computeSeries(score, ctx, `${month}-01`, monthEnd)
  const hasCheckins = curve.some((p) => p.n > 0)

  return (
    <div>
      <h2 class="sub">Tuần này so với tuần trước</h2>
      <div class="cards">
        {cards.map((c) => {
          const unit = c.mode === 'sum' ? 'phút' : c.unit
          const change = formatChange(c.id, unit, c.current, c.previous)
          return (
            <div class="card">
              <span class="muted">
                {c.mode === 'sum' ? `${c.label} (tổng tuần)` : labelWithScale(c.label, c.unit)}
              </span>
              <strong>{formatMetric(c.id, unit, c.current)}</strong>
              <span class={change ? `delta ${change.tone}` : 'muted'}>
                {change ? change.text : 'chưa đủ dữ liệu'}
              </span>
            </div>
          )
        })}
      </div>

      <h2 class="sub">Giấc ngủ 30 ngày</h2>
      {bars.length === 0 ? (
        <p class="muted">Chưa có giấc ngủ nào được ghi.</p>
      ) : (
        <SleepChart bars={bars} from={from} days={DAYS_SHOWN} />
      )}

      <h2 class="sub">Đường năng lượng trong ngày (30 ngày)</h2>
      {hasCheckins ? (
        <>
          <EnergyLine points={curve} />
          <p class="muted">
            {hi
              ? `Đỉnh quanh ${hi.peak}h, tụt quanh ${hi.dip}h (chênh ${hi.spread.toFixed(1).replace('.', ',')} điểm). Xếp deep work vào khung đỉnh, nghỉ ở khung tụt.`
              : 'Chưa đủ check-in (cần ít nhất 3 lần ở 3 khung giờ khác nhau) để chỉ ra giờ đỉnh và giờ tụt.'}
          </p>
        </>
      ) : (
        <p class="muted">
          Chưa có check-in năng lượng. Chạm 1–5 ở mục "Năng lượng bây giờ" trên tab Hôm nay vài lần
          mỗi ngày.
        </p>
      )}

      <h2 class="sub">Điểm ngày theo lịch</h2>
      <div class="datenav">
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          <Icon name="chevL" size={18} />
        </button>
        <strong>
          Tháng {month.slice(5)}/{month.slice(0, 4)}
        </strong>
        <button
          type="button"
          aria-label="Tháng sau"
          disabled={month >= today.slice(0, 7)}
          onClick={() => setMonth(addMonths(month, 1))}
        >
          <Icon name="chevR" size={18} />
        </button>
      </div>
      <MonthCalendar month={month} points={points} />
    </div>
  )
}
