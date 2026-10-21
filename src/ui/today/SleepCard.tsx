import { formatDuration } from '../../core/entryForm'
import { toHHmm } from '../../core/date'
import type { Entry } from '../../core/types'
import { Icon } from '../Icon'

/**
 * The one place for sleep: shows whether a night is open ("Đang ngủ từ 23:30"), how long last night
 * was, and the two buttons. Pressing is all it takes; times are saved automatically.
 */
export function SleepCard({
  open,
  lastNight,
  now,
  onSleep,
  onWake,
}: {
  open: Entry | undefined
  /** The night that ended this morning, if recorded. */
  lastNight: Entry | undefined
  now: number
  onSleep: () => void
  onWake: () => void
}) {
  const minutes = open
    ? Math.max(0, Math.round((now - new Date(open.start).getTime()) / 60_000))
    : 0
  const lastMin = lastNight?.end
    ? Math.round((new Date(lastNight.end).getTime() - new Date(lastNight.start).getTime()) / 60_000)
    : null
  return (
    <section class={open ? 'panel sleepcard sleeping' : 'panel sleepcard'}>
      <div class="sleep-info">
        <span class="sleep-ico">
          <Icon name={open ? 'moon' : 'sun'} size={24} />
        </span>
        <div>
          {open ? (
            <>
              <strong>Đang ngủ từ {toHHmm(open.start)}</strong>
              <span class="muted">Đã {formatDuration(minutes)}. Dậy thì bấm "Thức dậy".</span>
            </>
          ) : lastNight && lastMin ? (
            <>
              <strong>Đêm qua ngủ {formatDuration(lastMin)}</strong>
              <span class="muted">
                {toHHmm(lastNight.start)} → {lastNight.end ? toHHmm(lastNight.end) : ''}
                {lastNight.payload.estimated ? ' (giờ ngủ ước lượng)' : ''}
              </span>
            </>
          ) : (
            <>
              <strong>Giấc ngủ</strong>
              <span class="muted">Chỉ cần bấm, giờ tự lưu.</span>
            </>
          )}
        </div>
      </div>
      <div class="sleep-actions">
        {!open && (
          <button type="button" class="btn" onClick={onSleep}>
            <Icon name="moon" size={18} /> Đi ngủ
          </button>
        )}
        <button type="button" class={open ? 'btn btn-primary' : 'btn'} onClick={onWake}>
          <Icon name="sun" size={18} /> Thức dậy
        </button>
      </div>
    </section>
  )
}
