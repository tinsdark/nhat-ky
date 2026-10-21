import { useEffect } from 'preact/hooks'
import { toDateKey } from '../core/date'
import { dailyPicks } from '../core/insights'
import type { Insight } from '../core/types'
import { getInsightStore, giveFeedback, refreshInsights } from '../data/insights'
import { getSettings } from '../data/repository'
import { useLive } from './useLive'

export function AdviceCards({
  emptyText,
  onTry,
}: {
  emptyText: string
  onTry?: (insight: Insight) => void
}) {
  const store = useLive(getInsightStore, [])
  const settings = useLive(getSettings, [])
  useEffect(() => {
    void refreshInsights().catch((err) => console.warn('insights', err))
  }, [])

  if (!store || !settings) return null
  const today = toDateKey(Date.now(), settings.dayStartHour)
  const picks = dailyPicks(store, today)
  if (picks.length === 0) return <div class="card advice muted">{emptyText}</div>

  return (
    <div class="stack tight">
      {picks.map((i) => (
        <div class="card advice">
          <span>{i.text}</span>
          <div class="fb">
            <button
              type="button"
              onClick={() => (onTry ? onTry(i) : void giveFeedback(i.id, 'try'))}
            >
              Thử
            </button>
            <button type="button" onClick={() => void giveFeedback(i.id, 'helpful')}>
              Hữu ích
            </button>
            <button type="button" onClick={() => void giveFeedback(i.id, 'wrong')}>
              Không đúng
            </button>
            <button type="button" onClick={() => void giveFeedback(i.id, 'hide')}>
              Ẩn 2 tuần
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
