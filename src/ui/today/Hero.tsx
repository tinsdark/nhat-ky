import type { CoreItem } from '../../core/timeline'
import { Icon } from '../Icon'

const R = 26
const C = 2 * Math.PI * R

/** Today's overview: a ring with x/y core items recorded and the six items as chips (a missing one is a plain chip). */
export function Hero({ items, isToday }: { items: CoreItem[]; isToday: boolean }) {
  const done = items.filter((i) => i.done).length
  return (
    <section class="panel hero" aria-label={`Đã ghi ${done}/${items.length} mục chính trong ngày`}>
      <div class="hero-top">
        <svg viewBox="0 0 64 64" class="ring" aria-hidden="true">
          <circle cx="32" cy="32" r={R} fill="none" stroke="var(--surface)" stroke-width="7" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke="var(--accent)"
            stroke-width="7"
            stroke-linecap="round"
            stroke-dasharray={`${(done / items.length) * C} ${C}`}
            transform="rotate(-90 32 32)"
          />
          <text
            x="32"
            y="37"
            text-anchor="middle"
            font-size="16"
            font-weight="700"
            fill="var(--fg)"
          >
            {done}/{items.length}
          </text>
        </svg>
        <div>
          <strong class="hero-title">
            {done === items.length
              ? 'Đã ghi đủ'
              : `Đã ghi ${done}/${items.length} mục chính trong ngày`}
          </strong>
          {done === items.length && (
            <span class="muted">{isToday ? 'Hôm nay đủ cả rồi.' : 'Ngày này ghi đủ cả.'}</span>
          )}
        </div>
      </div>
      <div class="coreitems">
        {items.map((i) => (
          <span class={i.done ? 'core done' : 'core'}>
            {i.done && <Icon name="check" size={14} />}
            {i.label}
          </span>
        ))}
      </div>
    </section>
  )
}
