import { addDays } from '../core/date'
import { WEEKDAY_NAMES } from '../core/insights'
import { weekday } from '../core/date'
import { Icon } from './Icon'

/** Day picker pill: ‹ Thứ Tư, 21/10 [Hôm nay] ›, with a one-tap way back to today. */
export function DateNav({
  dateKey,
  todayKey,
  onChange,
}: {
  dateKey: string
  todayKey: string
  onChange: (dateKey: string) => void
}) {
  const isToday = dateKey === todayKey
  return (
    <div class="datepill">
      <button type="button" aria-label="Ngày trước" onClick={() => onChange(addDays(dateKey, -1))}>
        <Icon name="chevL" size={18} />
      </button>
      <div class="when">
        <strong>
          {WEEKDAY_NAMES[weekday(dateKey)]}, {dateKey.slice(8)}/{dateKey.slice(5, 7)}
        </strong>
        {isToday ? (
          <span class="badge">Hôm nay</span>
        ) : (
          <button type="button" class="badge link" onClick={() => onChange(todayKey)}>
            Về hôm nay
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Ngày sau"
        disabled={isToday}
        onClick={() => onChange(addDays(dateKey, 1))}
      >
        <Icon name="chevR" size={18} />
      </button>
    </div>
  )
}
