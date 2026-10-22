import { toHHmm } from '../core/date'
import { formatMl } from '../core/water'
import type { Entry } from '../core/types'
import { SwipeRow } from './SwipeRow'

/** Every drink behind the day's "Nước" row; tapping one opens it to edit or delete. */
export function WaterList({
  entries,
  onOpen,
  onDelete,
  onEdit,
  onClose,
}: {
  entries: Entry[]
  onOpen: (e: Entry) => void
  /** Swipe left / right on one drink. */
  onDelete: (e: Entry) => void
  onEdit: (e: Entry) => void
  onClose: () => void
}) {
  const total = entries.reduce((s, e) => s + (e.value ?? 0), 0)
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>
          Nước: {entries.length} lần · {formatMl(total)}
        </h2>
        <ul class="rows">
          {entries.map((e) => (
            <SwipeRow onDelete={() => onDelete(e)} onEdit={() => onEdit(e)}>
              <button type="button" class="rowbtn" onClick={() => onOpen(e)}>
                <span class="when">
                  <strong>{toHHmm(e.start)}</strong>
                </span>
                <span class="grow">
                  <span class="title">
                    {e.value !== null ? `${e.value} ml` : 'Không ghi lượng'}
                  </span>
                </span>
              </button>
            </SwipeRow>
          ))}
        </ul>
        <button type="button" class="btn" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  )
}
