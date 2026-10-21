import type { Habit } from '../../core/types'
import { Icon } from '../Icon'

export interface HabitState {
  habit: Habit
  value: number
  met: boolean
  /** Filled in by the app (water, exercise, a metric): no button. */
  auto: boolean
}

/** Today's habits with their tick buttons, so they can be done without leaving Hôm nay. */
export function HabitsToday({
  states,
  onTick,
  onUntick,
}: {
  states: HabitState[]
  onTick: (h: Habit) => void
  onUntick: (h: Habit) => void
}) {
  if (states.length === 0) return null
  const done = states.filter((s) => s.met).length
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>Thói quen hôm nay</h2>
        <span class="muted">
          {done}/{states.length}
        </span>
      </div>
      <ul class="rows">
        {states.map(({ habit: h, value, met, auto }) => (
          <li>
            <span class={met ? 'dot-ok on' : 'dot-ok'}>
              {met && <Icon name="check" size={14} />}
            </span>
            <div class="grow">
              <span class="title">{h.name}</span>
              <span class="sub">
                {h.kind === 'check'
                  ? met
                    ? 'Đã xong'
                    : 'Chưa xong'
                  : `${Math.round(value)}/${h.target.value}${h.kind === 'duration' ? ' phút' : ''}`}
                {auto ? ' · tự tính' : ''}
              </span>
            </div>
            {!auto &&
              (h.kind === 'check' ? (
                <button
                  type="button"
                  class={met ? 'tick on' : 'tick'}
                  aria-label={met ? 'Bỏ tick' : 'Tick'}
                  onClick={() => (met ? onUntick(h) : onTick(h))}
                >
                  <Icon name="check" size={20} />
                </button>
              ) : (
                <button type="button" class="tick" aria-label="Thêm" onClick={() => onTick(h)}>
                  {h.kind === 'duration' ? '+10′' : '+1'}
                </button>
              ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
