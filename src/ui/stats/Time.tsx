import { formatDuration } from '../../core/entryForm'
import { weekday } from '../../core/date'
import {
  avgByGroup,
  budgetProgress,
  byProject,
  deepHeatmap,
  GROUPS,
  hoursByGroup,
  weekStack,
} from '../../core/timeStats'
import { Donut, HourHeatmap, StackedColumns } from '../charts'
import type { StatsData } from './shared'

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const COLORS = ['var(--accent)', 'var(--ok)', 'var(--warn)']
const h = (hours: number) => formatDuration(Math.round(hours * 60))

/** SPEC 4.3 and 4.4: where the time goes today and this week, when deep work happens, per project, budgets. */
export function Time({ data }: { data: StatsData }) {
  const { ctx, today, defs } = data
  const cats = defs.categories
  const todayH = hoursByGroup(ctx, cats, today)
  const avg = avgByGroup(ctx, cats, today)
  const week = weekStack(ctx, cats, today)
  const heat = deepHeatmap(ctx, today)
  const projects = byProject(ctx, today.slice(0, 7))
  const budgets = budgetProgress(ctx, today)

  return (
    <div>
      <h2 class="sub">Hôm nay</h2>
      <div class="donut-row">
        <Donut values={GROUPS.map((g) => todayH[g.id])} />
        <ul class="legend-list">
          {GROUPS.map((g, i) => (
            <li>
              <span class="swatch" style={{ background: COLORS[i] }} /> {g.label}:{' '}
              <strong>{h(todayH[g.id])}</strong>
              {avg && <span class="muted"> · TB 30 ngày {h(avg[g.id])}</span>}
            </li>
          ))}
        </ul>
      </div>

      <h2 class="sub">Ngân sách tuần này</h2>
      <div class="stack tight">
        {budgets.map((b) => {
          const pct = Math.min(100, (b.hours / b.budget) * 100)
          const bad = b.kind === 'max' ? b.hours > b.budget : false
          return (
            <div class="card">
              <span>
                {b.label}: <strong>{h(b.hours)}</strong> / {b.kind === 'min' ? '≥' : '≤'} {b.budget}
                h
              </span>
              <div class={bad ? 'bar over' : 'bar'}>
                <div style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <h2 class="sub">7 ngày qua · deep work {h(week.deepHours)}</h2>
      <StackedColumns
        days={week.days.map((d) => ({ values: GROUPS.map((g) => d.hours[g.id]) }))}
        labels={week.days.map((d) => DAYS[weekday(d.dateKey)]!)}
      />
      <ul class="legend-list inline">
        {GROUPS.map((g, i) => (
          <li>
            <span class="swatch" style={{ background: COLORS[i] }} /> {g.label}
          </li>
        ))}
      </ul>

      <h2 class="sub">Deep work theo giờ trong ngày (90 ngày)</h2>
      <HourHeatmap minutes={heat.minutes} focus={heat.focus} />
      <p class="muted hint">
        Ô càng đậm càng nhiều phút deep work; viền xanh = tập trung trung bình ≥ 4.
      </p>

      <h2 class="sub">Theo dự án tháng {today.slice(5, 7)}</h2>
      {projects.length === 0 ? (
        <p class="muted">Chưa có khối làm việc nào trong tháng.</p>
      ) : (
        <div class="stack tight">
          {projects.map((p) => (
            <div class="card row-card">
              <span>{p.project}</span>
              <strong>{h(p.hours)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
