import { useEffect, useState } from 'preact/hooks'
import { backfillDefaults, roundHHmm } from '../../core/backfill'
import { addDays, atTime, toDateKey, toHHmm } from '../../core/date'
import { addMinutes, copyToDay } from '../../core/entryForm'
import { buildTimeline, coreProgress } from '../../core/timeline'
import type { Category, Entry, QuickAction } from '../../core/types'
import {
  createEntry,
  getDefs,
  getEntriesByDateKey,
  getSettings,
  restoreEntry,
  softDeleteEntry,
} from '../../data/repository'
import { CategoryPicker } from '../CategoryPicker'
import { DateNav } from '../DateNav'
import { EntryDetail } from '../EntryDetail'
import { Icon } from '../Icon'
import { draftFromEntry, EntryForm, type FormDraft } from '../EntryForm'
import { parseHashQuery } from '../route'
import { Timeline } from '../today/Timeline'
import { Toast, type ToastData } from '../Toast'
import { useLive } from '../useLive'

/** Sleep has two quick buttons on Hôm nay; here one "Ngủ đêm" preset replaces both. */
const SLEEP_ACTIONS = new Set(['qa-sleep', 'qa-wake'])

/**
 * Where things already done are written down afterwards, apart from Hôm nay (which is only for
 * pressing in real time). Times are estimates, so every entry made here is stored with
 * `source = 'backfill'` and shows as "ghi bù".
 */
export function Backfill() {
  const settings = useLive(getSettings, [])
  const defs = useLive(getDefs, [])
  const dayStartHour = settings?.dayStartHour ?? 4
  const todayKey = toDateKey(Date.now(), dayStartHour)
  const [dateKey, setDateKey] = useState(todayKey)
  const ownEntries = useLive(() => getEntriesByDateKey(dateKey), [dateKey])
  // "Ngủ đêm qua": the night before this day, which started on the previous logical day.
  const prevNight = useLive(async () => {
    const prev = await getEntriesByDateKey(addDays(dateKey, -1))
    return prev.filter(
      (e) => e.type === 'sleep' && e.end !== null && toDateKey(e.end, dayStartHour) === dateKey,
    )
  }, [dateKey, dayStartHour])
  const entries = ownEntries && prevNight ? [...prevNight, ...ownEntries] : undefined
  const [form, setForm] = useState<FormDraft | null>(null)
  const [detail, setDetail] = useState<Entry | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [pickFor, setPickFor] = useState<QuickAction | null>(null)

  // A gap on Hôm nay sends the user here with the day and the hours filled in.
  useEffect(() => {
    const apply = () => {
      const q = parseHashQuery(location.hash)
      if (!q.d) return
      setDateKey(q.d)
      setForm({
        dateKey: q.d,
        type: 'activity',
        categoryId: '',
        title: '',
        value: null,
        unit: '',
        note: '',
        start: atTime(q.d, q.s ?? '12:00', dayStartHour),
        end: q.e ? atTime(q.d, q.e, dayStartHour) : null,
        source: 'backfill',
      })
      history.replaceState(null, '', '#/backfill')
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [dayStartHour])

  if (!settings || !defs || !entries) return null

  const isToday = dateKey === todayKey
  const fallback = isToday ? roundHHmm(toHHmm(Date.now())) : '12:00'

  const draftFor = (
    a: Pick<QuickAction, 'type' | 'categoryId' | 'title' | 'value' | 'unit'>,
    day = dateKey,
  ): FormDraft => {
    const d = backfillDefaults(a, fallback)
    const start = atTime(day, d.start, dayStartHour)
    return {
      dateKey: day,
      type: a.type,
      categoryId: a.categoryId,
      title: a.title,
      value: a.value,
      unit: a.unit,
      note: '',
      start,
      end: d.minutes ? addMinutes(start, d.minutes) : null,
      source: 'backfill',
    }
  }

  const showSaved = (entry: Entry, isNew: boolean) => {
    setForm(null)
    setToast({
      id: Date.now(),
      text: isNew ? `Đã ghi bù: ${entry.title || 'mục mới'}` : 'Đã lưu',
      onEdit: () => setForm(draftFromEntry(entry)),
      onUndo: isNew ? () => void softDeleteEntry(entry.id) : undefined,
    })
  }

  const presets = [...defs.quickActions]
    .sort((a, b) => a.order - b.order)
    .filter((a) => !SLEEP_ACTIONS.has(a.id))
  const written = entries.filter((e) => e.source === 'backfill')
  // What the day still lacks, so those tiles can say "chưa có".
  const missing = new Set(
    coreProgress(entries, undefined)
      .filter((i) => !i.done)
      .map((i) => i.id),
  )
  const lacks = (a: QuickAction) =>
    (a.type === 'meal' &&
      (a.categoryId
        ? (a.categoryId === 'cat-breakfast' && missing.has('breakfast')) ||
          (a.categoryId === 'cat-lunch' && missing.has('lunch')) ||
          (a.categoryId === 'cat-dinner' && missing.has('dinner'))
        : missing.has('breakfast') || missing.has('lunch') || missing.has('dinner'))) ||
    (a.type === 'work' && missing.has('work'))
  // A shortcut with its own category goes straight to the form; a type shortcut lists the categories first.
  const press = (a: QuickAction) => {
    if (a.categoryId || a.type === 'water') return setForm(draftFor(a))
    setPickFor(a)
  }
  const pickCategory = (a: QuickAction, c: Category | null) => {
    setPickFor(null)
    setForm(draftFor({ ...a, categoryId: c?.id ?? '', title: c?.name ?? a.name }))
  }

  /** Swipe left on a row: soft delete with Hoàn tác. Swipe right: straight to the edit form. */
  const swipeDelete = (e: Entry) => {
    void softDeleteEntry(e.id)
    setToast({ id: Date.now(), text: 'Đã xoá', onUndo: () => void restoreEntry(e.id) })
  }
  const swipeEdit = (e: Entry) => setForm(draftFromEntry(e))

  return (
    <section class="screen">
      <h1>Ghi bù</h1>
      <p class="muted lead">Ghi những việc đã làm xong mà chưa kịp bấm ở Hôm nay.</p>

      <DateNav dateKey={dateKey} todayKey={todayKey} onChange={setDateKey} />

      <section class="panel">
        <div class="panel-head">
          <h2>Chọn việc đã làm</h2>
        </div>
        <div class="quickgrid">
          <button
            type="button"
            class={missing.has('sleep') ? 'quick suggest' : 'quick'}
            onClick={() =>
              setForm(
                draftFor(
                  {
                    type: 'sleep',
                    categoryId: 'cat-sleep',
                    title: 'Ngủ đêm',
                    value: null,
                    unit: '',
                  },
                  addDays(dateKey, -1),
                ),
              )
            }
          >
            <span class="ico">
              <Icon name="moon" size={24} />
            </span>
            Ngủ đêm qua
            {missing.has('sleep') && <span class="need">chưa có</span>}
          </button>
          {presets.map((a) => (
            <button
              type="button"
              class={lacks(a) ? 'quick suggest' : 'quick'}
              onClick={() => press(a)}
            >
              <span
                class="ico"
                style={{
                  background: `color-mix(in srgb, ${(defs.categories.find((c) => c.id === a.categoryId) ?? defs.categories.find((c) => c.entryType === a.type))?.color ?? 'var(--border)'} 22%, var(--card))`,
                }}
              >
                {a.icon}
              </span>
              {a.name}
              {lacks(a) && <span class="need">chưa có</span>}
            </button>
          ))}
          <button
            type="button"
            class="quick add"
            onClick={() =>
              setForm(
                draftFor({ type: 'activity', categoryId: '', title: '', value: null, unit: '' }),
              )
            }
          >
            <span class="ico">
              <Icon name="plus" size={22} />
            </span>
            Việc khác
          </button>
        </div>
        <p class="muted hint">
          Giờ có sẵn là giờ thường ngày của mục đó (ví dụ ăn trưa 12:00); chỉnh lại hoặc chọn thời
          lượng ước lượng rồi bấm Lưu. Các mục ở đây được đánh dấu "ghi bù".
        </p>
      </section>

      <Timeline
        rows={buildTimeline(written, { gapMinutes: Infinity })}
        categories={defs.categories}
        tags={defs.tags}
        dateKey={dateKey}
        onOpen={setDetail}
        onSwipeDelete={swipeDelete}
        onSwipeEdit={swipeEdit}
        title="Đã ghi bù ngày này"
        emptyText="Chưa có mục ghi bù nào cho ngày này."
      />

      {detail && (
        <EntryDetail
          entry={detail}
          categories={defs.categories}
          tags={defs.tags}
          canCopyToToday={!isToday}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm(draftFromEntry(detail))
            setDetail(null)
          }}
          onDuplicate={() => {
            setForm({ ...draftFromEntry(detail), id: undefined, source: 'backfill' })
            setDetail(null)
          }}
          onDelete={() => {
            const id = detail.id
            void softDeleteEntry(id)
            setDetail(null)
            setToast({ id: Date.now(), text: 'Đã xoá', onUndo: () => void restoreEntry(id) })
          }}
          onCopyToToday={async () => {
            const copy = await createEntry({
              ...copyToDay(detail, todayKey, dayStartHour),
              source: 'backfill',
            })
            setDetail(null)
            setToast({
              id: Date.now(),
              text: 'Đã chép sang hôm nay',
              onUndo: () => void softDeleteEntry(copy.id),
            })
          }}
        />
      )}
      {pickFor && (
        <CategoryPicker
          title={pickFor.name}
          action={pickFor}
          categories={defs.categories}
          onPick={(c) => pickCategory(pickFor, c)}
          onOther={() => pickCategory(pickFor, null)}
          onClose={() => setPickFor(null)}
        />
      )}
      {form && (
        <EntryForm
          draft={form}
          categories={defs.categories}
          tags={defs.tags}
          dayStartHour={dayStartHour}
          onClose={() => setForm(null)}
          onSaved={showSaved}
        />
      )}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </section>
  )
}
