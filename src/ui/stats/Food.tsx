import { food30, MAIN_SLOTS, todayFood, weekMealTable } from '../../core/foodStats'
import { weekday } from '../../core/date'
import { formatMetric } from '../../core/stats'
import type { StatsData } from './shared'

const SLOT_LABEL = { breakfast: 'Sáng', lunch: 'Trưa', dinner: 'Tối' } as const
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** SPEC 3.3: today's meals and water, the week as a table, and 30-day figures. */
export function Food({ data }: { data: StatsData }) {
  const { ctx, today } = data
  const t = todayFood(ctx, today)
  const rows = weekMealTable(ctx, today)
  const f = food30(ctx, today)
  const waterPct = Math.min(100, (t.waterMl / t.waterTargetMl) * 100)
  const clock = (h: number | null) => formatMetric('dinner_time', 'giờ', h)

  return (
    <div>
      <h2 class="sub">Hôm nay</h2>
      <div class="cards three">
        {t.meals.map((m) => (
          <div class={m.done ? 'card done' : 'card'}>
            <span class="muted">{SLOT_LABEL[m.slot]}</span>
            <strong>{m.done ? m.time : 'Chưa'}</strong>
          </div>
        ))}
      </div>
      <div class="card" style={{ marginTop: '8px' }}>
        <span class="muted">
          Nước: {t.waterMl}/{t.waterTargetMl} ml · Cà phê: {t.coffee} ly
        </span>
        <div class="meter">
          <div style={{ width: `${waterPct}%` }} />
        </div>
      </div>

      <h2 class="sub">7 ngày qua</h2>
      <table class="grid">
        <thead>
          <tr>
            <th />
            {MAIN_SLOTS.map((s) => (
              <th>{SLOT_LABEL[s]}</th>
            ))}
            <th>Khuya</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr>
              <th>{DAYS[weekday(r.dateKey)]}</th>
              {MAIN_SLOTS.map((s) => (
                <td class={`cell-${r.meals[s].status}`}>{r.meals[s].time ?? ''}</td>
              ))}
              <td class={r.late ? 'cell-late' : ''}>{r.late ? '●' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="muted hint">
        Ô trống = bỏ bữa (ngày có ghi chép), ô gạch = ngày chưa ghi gì, ô đỏ = ăn khuya.
      </p>

      <h2 class="sub">30 ngày ({f.loggedDays} ngày có ghi)</h2>
      {f.loggedDays === 0 ? (
        <p class="muted">Chưa có dữ liệu.</p>
      ) : (
        <div class="cards">
          {MAIN_SLOTS.map((s) => (
            <div class="card">
              <span class="muted">Giờ ăn {SLOT_LABEL[s].toLowerCase()} trung bình</span>
              <strong>{clock(f.avgTime[s])}</strong>
              <span class="muted">
                bỏ {f.skipped[s]}/{f.loggedDays} ngày
              </span>
            </div>
          ))}
          <div class="card">
            <span class="muted">Khung ăn trung bình</span>
            <strong>{formatMetric('eating_window', 'giờ', f.avgWindow)}</strong>
            <span class="muted">bữa đầu → bữa cuối</span>
          </div>
          <div class="card">
            <span class="muted">Ăn ngoài / giao</span>
            <strong>
              {f.eatingOutShare === null ? '–' : `${Math.round(f.eatingOutShare * 100)}%`}
            </strong>
            <span class="muted">trên các bữa có ghi nơi ăn</span>
          </div>
          <div class="card wide">
            <span class="muted">Món hay ăn nhất</span>
            {f.topDishes.length === 0 ? (
              <strong>–</strong>
            ) : (
              f.topDishes.map((d) => (
                <span>
                  {d.name} <span class="muted">×{d.count}</span>
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
