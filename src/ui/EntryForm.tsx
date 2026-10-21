import { useEffect, useRef, useState } from 'preact/hooks'
import { addDays, atTime, toDateKey, toHHmm } from '../core/date'
import { MAX_PHOTOS_PER_ENTRY } from '../core/photo'
import { autoMealSlot, findOverlaps, shiftHHmm, suggestTitles } from '../core/entryForm'
import type { Category, Entry, EntryType } from '../core/types'
import { createEntry, getEntriesInRange, updateEntry } from '../data/repository'
import { PhotoError, photos, pokePhotoQueue, processPhoto } from '../photos'
import { PayloadFields, type Payload } from './PayloadFields'
import { Thumb } from './PhotoViews'

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
  photoIds?: string[]
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
    photoIds: e.photoIds,
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
  const [photoIds, setPhotoIds] = useState<string[]>(draft.photoIds ?? [])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const added = useRef<string[]>([])
  const saved = useRef(false)
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

  const close = () => {
    // Photos picked in this form and never saved would be orphans.
    if (!saved.current) void photos.remove(added.current)
    onClose()
  }

  const addPhoto = async (file: File) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { blob, thumb, takenAt } = await processPhoto(file)
      const id = await photos.add(blob, thumb)
      added.current.push(id)
      setPhotoIds((ids) => [...ids, id])
      // The capture time is the most exact meal time there is.
      if (type === 'meal' && !draft.id && takenAt) {
        if (toDateKey(takenAt, dayStartHour) === draft.dateKey) {
          setStart(toHHmm(takenAt))
          setField('timeSource', 'photo')
          setNotice(`Giờ ăn lấy theo giờ chụp ảnh (${toHHmm(takenAt)}).`)
        } else setNotice('Ảnh chụp vào ngày khác, giờ giữ nguyên.')
      }
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : 'Không thêm được ảnh.')
    } finally {
      setBusy(false)
    }
  }

  const removePhoto = (id: string) => {
    setPhotoIds((ids) => ids.filter((x) => x !== id))
    if (added.current.includes(id)) {
      added.current = added.current.filter((x) => x !== id)
      void photos.remove([id])
    }
  }

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
      photoIds,
      payload:
        type === 'meal' && !payload.mealSlot
          ? { ...payload, mealSlot: autoMealSlot(categoryId, start) }
          : payload,
    }
    const result = draft.id
      ? await updateEntry(draft.id, fields)
      : await createEntry({ ...fields, source: draft.source ?? 'manual' })
    saved.current = true
    // Photos taken off a saved entry go with it.
    await photos.remove((draft.photoIds ?? []).filter((id) => !photoIds.includes(id)))
    if (photoIds.length > 0) pokePhotoQueue()
    onSaved(result, !draft.id)
  }

  return (
    <div class="sheet-backdrop" onClick={close}>
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
        <div class="field">
          <span class="lbl">
            Ảnh ({photoIds.length}/{MAX_PHOTOS_PER_ENTRY})
          </span>
          <div class="thumbs">
            {photoIds.map((id) => (
              <span class="wrap">
                <Thumb id={id} size={64} />
                <button
                  type="button"
                  class="rm"
                  aria-label="Bỏ ảnh"
                  onClick={() => removePhoto(id)}
                >
                  ×
                </button>
              </span>
            ))}
            {photoIds.length < MAX_PHOTOS_PER_ENTRY && (
              <label class="btn addphoto">
                {busy ? 'Đang xử lý…' : '📷 Thêm ảnh'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0]
                    e.currentTarget.value = ''
                    if (f) void addPhoto(f)
                  }}
                />
              </label>
            )}
          </div>
          {notice && <p class="muted">{notice}</p>}
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
          <button type="button" class="btn" onClick={close}>
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
