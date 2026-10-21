import { useState } from 'preact/hooks'
import { toHHmm } from '../core/date'
import { tagName } from '../core/defs'
import type { Category, Entry, Tag } from '../core/types'
import { PhotoViewer, Thumb } from './PhotoViews'

export function EntryDetail({
  entry,
  categories,
  tags,
  canCopyToToday,
  onEdit,
  onDuplicate,
  onDelete,
  onCopyToToday,
  onClose,
}: {
  entry: Entry
  categories: Category[]
  tags: Tag[]
  /** Shown when browsing a day other than today. */
  canCopyToToday: boolean
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onCopyToToday: () => void
  onClose: () => void
}) {
  const [viewing, setViewing] = useState<string | null>(null)
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
        {entry.tags.length > 0 && (
          <div class="chips">
            {entry.tags
              .map((id) => tagName(tags, id))
              .filter(Boolean)
              .map((n) => (
                <span class="chip">{n}</span>
              ))}
          </div>
        )}
        {entry.note && <p>{entry.note}</p>}
        {entry.photoIds.length > 0 && (
          <div class="thumbs">
            {entry.photoIds.map((id) => (
              <Thumb id={id} size={96} onClick={() => setViewing(id)} />
            ))}
          </div>
        )}
        {viewing && <PhotoViewer id={viewing} onClose={() => setViewing(null)} />}
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
