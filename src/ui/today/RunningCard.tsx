import { useEffect, useState } from 'preact/hooks'
import { toHHmm } from '../../core/date'
import { formatDuration } from '../../core/entryForm'
import { finishPatch } from '../../core/running'
import type { Category, Entry } from '../../core/types'
import { Icon } from '../Icon'

/**
 * Blocks started and not yet ended. "Kết thúc" stamps the current time; when the block is too old for
 * that to make sense (a forgotten press) it opens the form so the end time is typed by hand.
 */
export function RunningCard({
  entries,
  categories,
  onFinish,
  onEdit,
}: {
  entries: Entry[]
  categories: Category[]
  onFinish: (e: Entry) => void
  onEdit: (e: Entry) => void
}) {
  const [, setTick] = useState(0) // re-render every 30 s so the minutes keep moving
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  if (entries.length === 0) return null
  // Read at render time: a block started a moment ago must not look "in the future" against a stale clock.
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  return (
    <section class="panel running">
      <div class="panel-head">
        <h2>Đang làm</h2>
      </div>
      {entries.map((e) => {
        const cat = categories.find((c) => c.id === e.categoryId)
        const minutes = Math.max(0, Math.round((now - new Date(e.start).getTime()) / 60_000))
        const stale = finishPatch(e, nowIso) === null
        return (
          <div class="running-row" key={e.id}>
            <button type="button" class="running-info" onClick={() => onEdit(e)}>
              <span class="ico">{cat?.icon ?? '⏱'}</span>
              <span class="running-text">
                <b>{e.title || cat?.name}</b>
                <span class="muted">
                  từ {toHHmm(e.start)} · {stale ? 'quá lâu, kiểm tra lại' : formatDuration(minutes)}
                </span>
              </span>
            </button>
            <button
              type="button"
              class="btn btn-primary small"
              onClick={() => (stale ? onEdit(e) : onFinish(e))}
            >
              <Icon name="check" size={14} /> {stale ? 'Sửa giờ' : 'Kết thúc'}
            </button>
          </div>
        )
      })}
    </section>
  )
}
