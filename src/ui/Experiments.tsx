import { describeResult } from '../core/experiments'
import { dayStatus } from '../core/habits'
import type { MetricContext, Metric } from '../core/metrics'
import { dateKeyRange } from '../core/date'
import type { Experiment } from '../core/types'
import { decideExperiment } from '../data/experiments'
import { getInsightStore } from '../data/insights'
import { useLive } from './useLive'

export function Experiments({
  ctx,
  metrics,
  today,
}: {
  ctx: MetricContext
  metrics: Metric[]
  today: string
}) {
  const store = useLive(getInsightStore, [])
  const shown = (store?.experiments ?? []).filter(
    (e) => e.status === 'running' || e.status === 'finished',
  )
  if (shown.length === 0) return null
  const label = (e: Experiment) => metrics.find((m) => m.id === e.outcomeId)?.label ?? e.outcomeId

  return (
    <>
      <h2 class="sub">Thí nghiệm</h2>
      <div class="stack tight">
        {shown.map((e) => {
          if (e.status === 'finished' && e.result) {
            return (
              <div class="card advice">
                <strong>Xong: {e.title}</strong>
                <span>{describeResult(e, label(e), e.result)}</span>
                <div class="fb">
                  <button type="button" onClick={() => void decideExperiment(e.id, true)}>
                    Giữ thành thói quen
                  </button>
                  <button type="button" onClick={() => void decideExperiment(e.id, false)}>
                    Bỏ
                  </button>
                </div>
              </div>
            )
          }
          const habit = ctx.habits.find((h) => h.id === e.habitId)
          const values = habit ? ctx.habitValues(habit) : new Map<string, number>()
          const done = habit
            ? dateKeyRange(e.startDate, e.endDate < today ? e.endDate : today).filter(
                (d) => dayStatus(habit, d, values) === 'met',
              ).length
            : 0
          const day = Math.min(14, dateKeyRange(e.startDate, today).length)
          return (
            <div class="card advice">
              <strong>Đang thử: {e.title}</strong>
              <span class="muted">
                Ngày {day}/14 · làm đúng {done} ngày · đo {label(e).toLowerCase()}. Tick trong tab
                Thói quen.
              </span>
              <div class="fb">
                <button type="button" onClick={() => void decideExperiment(e.id, false)}>
                  Dừng
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
