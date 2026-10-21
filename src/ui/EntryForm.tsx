import { useEffect, useState } from 'preact/hooks'
import { addDays, atTime, toHHmm } from '../core/date'
import { autoMealSlot, findOverlaps, shiftHHmm, suggestTitles } from '../core/entryForm'
import type { Category, Entry, EntryType } from '../core/types'
import { createEntry, getEntriesInRange, updateEntry } from '../data/repository'
import { PayloadFields, type Payload } from './PayloadFields'

export interface FormDraft {
  /** Set when editing an existing entry. */
  id?: string
  dateKey: string
  type: EntryType
  categoryId: string
  title: string
  value: number | null
  unit: string
  note: string
  /** ISO. */
  start: string
  end: string | null
  payload?: Payload
  source?: Entry['source']
}

const TYPES: { id: EntryType; label: string }[] = [
  { id: 'sleep', label: 'Ngủ' },
  { id: 'meal', label: 'Ăn uống' },
  { id: 'work', label: 'Làm việc' },
  { id: 'activity', label: 'Hoạt động' },
  { id: 'exercise', label: 'Vận động' },
  { id: 'water', label: 'Uống nước' },
  { id: 'note', label: 'Check-in / ghi chú' },
]

export function draftFromEntry(e: Entry): FormDraft {
  return {
    id: e.id,
    dateKey: e.dateKey,
    type: e.type,
    categoryId: e.categoryId,
    title: e.title,
    value: e.value,
    unit: e.unit,
    note: e.note,
    start: e.start,
    end: e.end,
    payload: e.payload,
  }
}

export function EntryForm({
  draft,
  categories,
  dayStartHour,
  onClose,
  onSaved,
  onStartTimer,
}: {
  draft: FormDraft
  categories: Category[]
  dayStartHour: number
  onClose: () => void
  onSaved: (entry: Entry, isNew: boolean) => void
  /** Offered for new work entries: start a timer with the chosen category and title. */
  onStartTimer?: (fields: { categoryId: string; title: string }) => void
}) {
  const [type, setType] = useState(draft.type)
  const [categoryId, setCategoryId] = useState(draft.categoryId)
  const [title, setTitle] = useState(draft.title)
  const [start, setStart] = useState(toHHmm(draft.start))
  const [end, setEnd] = useState(draft.end ? toHHmm(draft.end) : '')
  const [value, setValue] = useState(draft.value?.toString() ?? '')
  const [unit, setUnit] = useState(draft.unit)
  const [note, setNote] = useState(draft.note)
  const [payload, setPayload] = useState<Payload>(draft.payload ?? {})
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Entry[]>([])
  useEffect(() => {
    void getEntriesInRange(addDays(draft.dateKey, -60), draft.dateKey).then(setHistory)
  }, [draft.dateKey])

  const setField = (key: string, v: unknown) =>
    setPayload((p) => {
      const next = { ...p }
      if (v === undefined) delete next[key]
      else next[key] = v
      return next
    })

  const startIso = atTime(draft.dateKey, start, dayStartHour)
  const endIso = end ? atTime(draft.dateKey, end, dayStartHour) : null
  const overlaps = findOverlaps(history, type, startIso, endIso, draft.id)

  const cats = categories.filter((c) => c.entryType === type && !c.archived)

  const save = async () => {
    if (endIso && endIso <= startIso) return setError('Giờ kết thúc phải sau giờ bắt đầu.')
    const num = value.trim() === '' ? null : Number(value.replace(',', '.'))
    if (num !== null && Number.isNaN(num)) return setError('Giá trị không hợp lệ.')
    const fields = {
      type,
      categoryId,
      title: title.trim(),
      value: num,
      unit: unit.trim(),
      note: note.trim(),
      start: startIso,
      end: endIso,
      payload:
        type === 'meal' && !payload.mealSlot
          ? { ...payload, mealSlot: autoMealSlot(categoryId, start) }
          : payload,
    }
    if (draft.id) onSaved(await updateEntry(draft.id, fields), false)
    else onSaved(await createEntry({ ...fields, source: draft.source ?? 'manual' }), true)
  }

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <form
        class="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <h2>{draft.id ? 'Sửa' : 'Ghi mới'}</h2>
        <label>
          Loại
          <select
            value={type}
            onChange={(e) => {
              setType(e.currentTarget.value as EntryType)
              setCategoryId('')
            }}
          >
            {TYPES.map((t) => (
              <option value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        {cats.length > 0 && (
          <label>
            Danh mục
            <select value={categoryId} onChange={(e) => setCategoryId(e.currentTarget.value)}>
              <option value="">—</option>
              {cats.map((c) => (
                <option value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Nội dung
          <input
            list="title-suggestions"
            value={title}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
          <datalist id="title-suggestions">
            {suggestTitles(history, type).map((t) => (
              <option value={t} />
            ))}
          </datalist>
        </label>
        <div class="row">
          <label>
            Bắt đầu
            <input
              type="time"
              required
              value={start}
              onInput={(e) => setStart(e.currentTarget.value)}
            />
          </label>
          <label>
            Kết thúc
            <input type="time" value={end} onInput={(e) => setEnd(e.currentTarget.value)} />
          </label>
        </div>
        <div class="row shift">
          {[15, 30, 60].map((m) => (
            <button type="button" class="btn" onClick={() => setStart(shiftHHmm(start, -m))}>
              Bắt đầu −{m === 60 ? '1h' : `${m}p`}
            </button>
          ))}
        </div>
        {overlaps.length > 0 && (
          <p class="warn">
            Trùng giờ với: {overlaps.map((o) => o.title || o.type).join(', ')} (vẫn lưu được).
          </p>
        )}
        <div class="row">
          <label>
            Giá trị
            <input
              inputMode="decimal"
              value={value}
              onInput={(e) => setValue(e.currentTarget.value)}
            />
          </label>
          <label>
            Đơn vị
            <input value={unit} onInput={(e) => setUnit(e.currentTarget.value)} />
          </label>
        </div>
        <PayloadFields type={type} payload={payload} set={setField} />
        <label>
          Ghi chú
          <textarea rows={2} value={note} onInput={(e) => setNote(e.currentTarget.value)} />
        </label>
        {error && <p class="error">{error}</p>}
        {onStartTimer && !draft.id && type === 'work' && (
          <button
            type="button"
            class="btn"
            onClick={() => onStartTimer({ categoryId, title: title.trim() })}
          >
            Bấm giờ ngay
          </button>
        )}
        <div class="row">
          <button type="button" class="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" class="btn btn-primary">
            Lưu
          </button>
        </div>
      </form>
    </div>
  )
}
