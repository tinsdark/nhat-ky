import { useEffect, useState } from 'preact/hooks'
import { backfillDefaults, roundHHmm } from '../../core/backfill'
import { addDays, atTime, toDateKey, toHHmm, weekday } from '../../core/date'
import { addMinutes, copyToDay } from '../../core/entryForm'
import type { Entry, QuickAction } from '../../core/types'
import {
  createEntry,
  getDefs,
  getEntriesByDateKey,
  getSettings,
  restoreEntry,
  softDeleteEntry,
} from '../../data/repository'
import { EntryDetail } from '../EntryDetail'
import { draftFromEntry, EntryForm, type FormDraft } from '../EntryForm'
import { parseHashQuery } from '../route'
import { Toast, type ToastData } from '../Toast'
import { useLive } from '../useLive'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
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
  const [dd, mm] = dateKey.slice(5).split('-').reverse()

  return (
    <section class="screen">
      <h1>Ghi bù</h1>
      <p class="muted hint">
        Ghi những việc đã làm xong mà chưa kịp bấm. Giờ ở đây chỉ là ước lượng, nên các mục này được
        đánh dấu "ghi bù" và tách khỏi tab Hôm nay.
      </p>

      <div class="datenav">
        <button
          type="button"
          aria-label="Ngày trước"
          onClick={() => setDateKey(addDays(dateKey, -1))}
        >
          ◀
        </button>
        <div>
          <strong>
            {WEEKDAYS[weekday(dateKey)]}, {dd}/{mm}
          </strong>
          {isToday && <span class="muted"> · Hôm nay</span>}
        </div>
        <button
          type="button"
          aria-label="Ngày sau"
          disabled={isToday}
          onClick={() => setDateKey(addDays(dateKey, 1))}
        >
          ▶
        </button>
      </div>

      <div class="quickgrid">
        <button
          type="button"
          class="quick"
          onClick={() =>
            setForm(
              draftFor(
                { type: 'sleep', categoryId: 'cat-sleep', title: 'Ngủ đêm', value: null, unit: '' },
                addDays(dateKey, -1),
              ),
            )
          }
        >
          <span class="ico">🌙</span>
          Ngủ đêm qua
        </button>
        {presets.map((a) => (
          <button type="button" class="quick" onClick={() => setForm(draftFor(a))}>
            <span class="ico">{a.icon}</span>
            {a.name}
          </button>
        ))}
        <button
          type="button"
          class="quick"
          onClick={() =>
            setForm(
              draftFor({ type: 'activity', categoryId: '', title: '', value: null, unit: '' }),
            )
          }
        >
          <span class="ico">＋</span>
          Khác
        </button>
      </div>

      <h2 class="sub">Đã ghi bù ngày này</h2>
      {written.length === 0 && <p class="muted">Chưa có mục ghi bù nào.</p>}
      <div class="timeline">
        {written.map((e) => (
          <button type="button" class="block" onClick={() => setDetail(e)}>
            <span class="time">
              {toHHmm(e.start)}
              {e.end ? `–${toHHmm(e.end)}` : ''}
            </span>
            <span>{e.title || e.type}</span>
          </button>
        ))}
      </div>

      {detail && (
        <EntryDetail
          entry={detail}
          categories={defs.categories}
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
      {form && (
        <EntryForm
          draft={form}
          categories={defs.categories}
          dayStartHour={dayStartHour}
          onClose={() => setForm(null)}
          onSaved={showSaved}
        />
      )}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </section>
  )
}
