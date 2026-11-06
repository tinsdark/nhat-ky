import { formatDuration } from '../../core/entryForm'
import { toHHmm } from '../../core/date'
import { tagName } from '../../core/defs'
import { latestCheckin, type TimelineRow } from '../../core/timeline'
import { formatMl } from '../../core/water'
import type { Category, Entry, Tag } from '../../core/types'
import { Icon } from '../Icon'
import { Thumb } from '../PhotoViews'
import { SwipeRow } from '../SwipeRow'

const colorOf = (cats: Category[], e: Entry) =>
  cats.find((c) => c.id === e.categoryId)?.color ?? 'var(--border)'
/** "4 lần · năng lượng 3, tâm trạng 4" (the latest of each) */
export function checkinSub(entries: Entry[]): string {
  const { energy, mood } = latestCheckin(entries)
  const latest = [
    energy !== null ? `năng lượng ${energy}` : null,
    mood !== null ? `tâm trạng ${mood}` : null,
  ].filter(Boolean)
  return [`${entries.length} lần`, latest.length ? `${latest.join(', ')}` : null]
    .filter(Boolean)
    .join(' · ')
}

const nameOf = (cats: Category[], e: Entry) => cats.find((c) => c.id === e.categoryId)?.name

/** The day as a list: time column, colour dot, title and details; gaps over 2 hours link to Ghi bù. */
export function Timeline({
  rows,
  categories,
  tags,
  dateKey,
  onOpen,
  onOpenGroup,
  onSwipeDelete,
  onSwipeEdit,
  title = 'Đã ghi trong ngày',
  emptyText = 'Chưa ghi gì. Chạm một nút ở trên để bắt đầu.',
}: {
  rows: TimelineRow[]
  categories: Category[]
  tags: Tag[]
  dateKey: string
  onOpen: (e: Entry) => void
  /** Opens the list behind a collapsed row (the day's water or check-ins). */
  onOpenGroup?: (kind: 'water' | 'checkin', entries: Entry[]) => void
  /** Swipe left / right on an entry row. Without both, rows are plain. */
  onSwipeDelete?: (e: Entry) => void
  onSwipeEdit?: (e: Entry) => void
  title?: string
  emptyText?: string
}) {
  const count = rows.reduce(
    (n, r) =>
      n +
      (r.kind === 'entry' ? 1 : r.kind === 'water' || r.kind === 'checkin' ? r.entries.length : 0),
    0,
  )
  const entryButton = (r: Extract<TimelineRow, { kind: 'entry' }>) => (
    <button type="button" class="rowbtn" onClick={() => onOpen(r.entry)}>
      <span class="when">
        <strong>{toHHmm(r.entry.start)}</strong>
        {r.entry.end && <span class="muted">{toHHmm(r.entry.end)}</span>}
      </span>
      <span class="bar" style={{ background: colorOf(categories, r.entry) }} />
      <span class="grow">
        <span class="title">
          {r.entry.title || nameOf(categories, r.entry) || r.entry.type}{' '}
          {r.entry.source === 'backfill' && <span class="tag">ghi bù</span>}
        </span>
        <span class="sub">
          {[
            r.minutes > 0 ? formatDuration(r.minutes) : null,
            r.entry.value != null ? `${r.entry.value} ${r.entry.unit}`.trim() : null,
            nameOf(categories, r.entry) && r.entry.title !== nameOf(categories, r.entry)
              ? nameOf(categories, r.entry)
              : null,
            ...r.entry.tags.map((id) => tagName(tags, id)),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {r.entry.photoIds.length > 0 && (
          <span class="strip">
            {r.entry.photoIds.map((id) => (
              <Thumb id={id} size={36} />
            ))}
          </span>
        )}
      </span>
    </button>
  )
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>{title}</h2>
        <span class="muted">{count} mục</span>
      </div>
      {rows.length === 0 ? (
        <p class="muted empty">{emptyText}</p>
      ) : (
        <ul class="rows tl">
          {rows.map((r) =>
            r.kind === 'gap' ? (
              <li class="gaprow">
                <a href={`#/backfill?d=${dateKey}&s=${toHHmm(r.start)}&e=${toHHmm(r.end)}`}>
                  <Icon name="plus" size={14} /> Chưa ghi {toHHmm(r.start)}–{toHHmm(r.end)} · chạm
                  để ghi bù
                </a>
              </li>
            ) : r.kind === 'water' ? (
              <li>
                <button
                  type="button"
                  class="rowbtn"
                  onClick={() => onOpenGroup?.('water', r.entries)}
                >
                  <span class="when">
                    <strong>{toHHmm(r.start)}</strong>
                    {r.entries.length > 1 && (
                      <span class="muted">{toHHmm(r.entries[r.entries.length - 1]!.start)}</span>
                    )}
                  </span>
                  <span class="bar" style={{ background: colorOf(categories, r.entries[0]!) }} />
                  <span class="grow">
                    <span class="title">Nước</span>
                    <span class="sub">
                      {r.entries.length} lần · {formatMl(r.ml)}
                    </span>
                  </span>
                </button>
              </li>
            ) : r.kind === 'checkin' ? (
              <li>
                <button
                  type="button"
                  class="rowbtn"
                  onClick={() => onOpenGroup?.('checkin', r.entries)}
                >
                  <span class="when">
                    <strong>{toHHmm(r.start)}</strong>
                    {r.entries.length > 1 && (
                      <span class="muted">{toHHmm(r.entries[r.entries.length - 1]!.start)}</span>
                    )}
                  </span>
                  <span class="bar" style={{ background: 'var(--border)' }} />
                  <span class="grow">
                    <span class="title">Check-in</span>
                    <span class="sub">{checkinSub(r.entries)}</span>
                  </span>
                </button>
              </li>
            ) : onSwipeDelete && onSwipeEdit ? (
              <SwipeRow onDelete={() => onSwipeDelete(r.entry)} onEdit={() => onSwipeEdit(r.entry)}>
                {entryButton(r)}
              </SwipeRow>
            ) : (
              <li>{entryButton(r)}</li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}
