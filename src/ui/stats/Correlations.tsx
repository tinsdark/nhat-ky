import { useMemo } from 'preact/hooks'
import { findCorrelations, lookback, weekdayFindings } from '../../core/correlation'
import { describeSides, WEEKDAY_NAMES } from '../../core/insights'
import { countLoggedDays, readiness } from '../../core/rules'
import type { StatsData } from './shared'

const OUTCOMES = ['day_score', 'mood', 'energy']
const fmt = (n: number) => n.toFixed(1).replace('.', ',')

/** SPEC 7.1 mục 5: what goes with good days and with bad days, and weekday differences once there is enough data. */
export function Correlations({ data }: { data: StatsData }) {
  const { ctx, metrics, today } = data
  const logged = countLoggedDays(ctx, today)
  const level = readiness(logged)
  const { good, bad, weekdays } = useMemo(() => {
    const range = lookback(today, 97)
    const byId = new Map(metrics.map((m) => [m.id, m]))
    const found = findCorrelations(ctx, metrics, range).filter((f) =>
      OUTCOMES.includes(f.outcomeId),
    )
    const sides = found.flatMap((f) => {
      const s = describeSides(f, byId)
      return s ? [{ f, s }] : []
    })
    const outcomes = metrics.filter((m) => OUTCOMES.includes(m.id))
    return {
      good: sides.slice(0, 5),
      bad: sides.slice(0, 5),
      weekdays: weekdayFindings(ctx, outcomes, range),
    }
  }, [ctx, metrics, today])

  if (level === 'describe' || level === 'rules') {
    return (
      <div class="card advice muted">
        Cần ít nhất 28 ngày có ghi chép để tìm cái đi kèm ngày tốt và ngày tệ (đã có {logged}).
      </div>
    )
  }
  if (good.length === 0)
    return (
      <div class="card advice muted">
        Chưa thấy yếu tố nào đủ rõ. Cần thêm dữ liệu hoặc thật sự chưa có quy luật.
      </div>
    )

  return (
    <div class="stack tight">
      <div class="card">
        <strong>Đi kèm ngày tốt</strong>
        <ul class="plain">
          {good.map(({ f, s }) => (
            <li>
              {s.goodCond}{' '}
              <span class="muted">
                → {s.what} trung bình {fmt(s.goodMean)} ({s.goodN} ngày)
              </span>
              {f.confidence === 'strong' && <span class="tag">chắc</span>}
            </li>
          ))}
        </ul>
      </div>
      <div class="card">
        <strong>Đi kèm ngày tệ</strong>
        <ul class="plain">
          {bad.map(({ s }) => (
            <li>
              {s.badCond}{' '}
              <span class="muted">
                → {s.what} trung bình {fmt(s.badMean)} ({s.badN} ngày)
              </span>
            </li>
          ))}
        </ul>
      </div>
      {weekdays.length > 0 && (
        <div class="card">
          <strong>Theo thứ trong tuần</strong>
          <ul class="plain">
            {weekdays.slice(0, 4).map((w) => {
              const m = metrics.find((x) => x.id === w.outcomeId)
              return (
                <li>
                  {WEEKDAY_NAMES[w.weekday]}: {m?.label} trung bình {fmt(w.mean)} so với{' '}
                  {fmt(w.restMean)} các ngày khác
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <p class="muted hint">
        Đi kèm không có nghĩa là gây ra. Muốn kiểm chứng thì bấm "Thử 14 ngày" ở thẻ lời khuyên.
      </p>
    </div>
  )
}
