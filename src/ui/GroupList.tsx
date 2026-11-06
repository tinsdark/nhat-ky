import { toHHmm } from '../core/date'
import type { Entry } from '../core/types'
import { formatMl } from '../core/water'
import { SwipeRow } from './SwipeRow'

/** Every entry behind a collapsed row (the day's water or check-ins); tapping one opens it to edit or delete. */
export function GroupList({
  entries,
  title,
  line,
  onOpen,
  onDelete,
  onEdit,
  onClose,
}: {
  entries: Entry[]
  /** Sheet heading, e.g. "Nước: 3 lần · 1 L". */
  title: string
  /** The text of one row. */
  line: (e: Entry) => string
  onOpen: (e: Entry) => void
  /** Swipe left / right on one row. */
  onDelete: (e: Entry) => void
  onEdit: (e: Entry) => void
  onClose: () => void
}) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <ul class="rows">
          {entries.map((e) => (
            <SwipeRow onDelete={() => onDelete(e)} onEdit={() => onEdit(e)}>
              <button type="button" class="rowbtn" onClick={() => onOpen(e)}>
                <span class="when">
                  <strong>{toHHmm(e.start)}</strong>
                </span>
                <span class="grow">
                  <span class="title">{line(e)}</span>
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

export type GroupKind = 'water' | 'checkin'

export function groupTitle(kind: GroupKind, entries: Entry[]): string {
  if (kind === 'checkin') return `Check-in: ${entries.length} lần`
  const total = entries.reduce((s, e) => s + (e.value ?? 0), 0)
  return `Nước: ${entries.length} lần · ${formatMl(total)}`
}

export function groupLine(kind: GroupKind): (e: Entry) => string {
  if (kind === 'water') return (e) => (e.value !== null ? `${e.value} ml` : 'Không ghi lượng')
  return (e) => {
    const c = (e.payload.checkin ?? {}) as { energy?: number; mood?: number }
    const parts = [
      c.energy !== undefined ? `năng lượng ${c.energy}/5` : null,
      c.mood !== undefined ? `tâm trạng ${c.mood}/5` : null,
    ].filter(Boolean)
    return parts.join(', ') || 'Check-in'
  }
}
