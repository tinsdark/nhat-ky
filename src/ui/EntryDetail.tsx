import { toHHmm } from '../core/date'
import type { Category, Entry } from '../core/types'

export function EntryDetail({
  entry,
  categories,
  canCopyToToday,
  onEdit,
  onDuplicate,
  onDelete,
  onCopyToToday,
  onClose,
}: {
  entry: Entry
  categories: Category[]
  /** Shown when browsing a day other than today. */
  canCopyToToday: boolean
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onCopyToToday: () => void
  onClose: () => void
}) {
  const category = categories.find((c) => c.id === entry.categoryId)?.name
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{entry.title || category || entry.type}</h2>
        <p class="muted">
          {toHHmm(entry.start)}
          {entry.end ? `–${toHHmm(entry.end)}` : ''}
          {category ? ` · ${category}` : ''}
          {entry.value != null ? ` · ${entry.value} ${entry.unit}` : ''}
        </p>
        {entry.note && <p>{entry.note}</p>}
        <div class="stack">
          <button type="button" class="btn btn-primary" onClick={onEdit}>
            Sửa
          </button>
          <button type="button" class="btn" onClick={onDuplicate}>
            Nhân bản
          </button>
          {canCopyToToday && (
            <button type="button" class="btn" onClick={onCopyToToday}>
              Chép sang hôm nay
            </button>
          )}
          <button type="button" class="btn btn-danger" onClick={onDelete}>
            Xoá
          </button>
        </div>
      </div>
    </div>
  )
}
