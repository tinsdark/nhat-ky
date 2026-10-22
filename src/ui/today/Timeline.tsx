import { formatDuration } from '../../core/entryForm'
import { toHHmm } from '../../core/date'
import { tagName } from '../../core/defs'
import type { TimelineRow } from '../../core/timeline'
import { formatMl } from '../../core/water'
import type { Category, Entry, Tag } from '../../core/types'
import { Icon } from '../Icon'
import { Thumb } from '../PhotoViews'

const colorOf = (cats: Category[], e: Entry) =>
  cats.find((c) => c.id === e.categoryId)?.color ?? 'var(--border)'
const nameOf = (cats: Category[], e: Entry) => cats.find((c) => c.id === e.categoryId)?.name

/** The day as a list: time column, colour dot, title and details; gaps over 2 hours link to Ghi bù. */
export function Timeline({
  rows,
  categories,
  tags,
  dateKey,
  onOpen,
  onOpenGroup,
  title = 'Đã ghi trong ngày',
  emptyText = 'Chưa ghi gì. Chạm một nút ở trên để bắt đầu.',
}: {
  rows: TimelineRow[]
  categories: Category[]
  tags: Tag[]
  dateKey: string
  onOpen: (e: Entry) => void
  /** Opens the list behind a collapsed row (the day's water). */
  onOpenGroup?: (entries: Entry[]) => void
  title?: string
  emptyText?: string
}) {
  const count = rows.reduce(
    (n, r) => n + (r.kind === 'entry' ? 1 : r.kind === 'water' ? r.entries.length : 0),
    0,
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
                <button type="button" class="rowbtn" onClick={() => onOpenGroup?.(r.entries)}>
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
            ) : (
              <li>
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
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}
