import { useEffect, useRef, useState } from 'preact/hooks'
import { addDays, atTime, toDateKey, toHHmm } from '../core/date'
import { MAX_PHOTOS_PER_ENTRY } from '../core/photo'
import {
  addMinutes,
  autoMealSlot,
  DURATION_CHOICES,
  findOverlaps,
  formatDuration,
  resolveEnd,
  shiftHHmm,
} from '../core/entryForm'
import { entryTypeOptions, newId, typeLabel } from '../core/defs'
import { isTimedType, startRunning, stopRunning } from '../core/running'
import type { Category, Entry, EntryType, Tag } from '../core/types'
import { createEntry, getDefs, getEntriesInRange, saveDefs, updateEntry } from '../data/repository'
import { PhotoError, photos, pokePhotoQueue, processPhoto } from '../photos'
import { PayloadFields, type Payload } from './PayloadFields'
import { Thumb } from './PhotoViews'
import { useLive } from './useLive'

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
  tags?: string[]
  photoIds?: string[]
  source?: Entry['source']
}

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
    tags: e.tags,
    photoIds: e.photoIds,
  }
}

export function EntryForm({
  draft,
  categories,
  tags,
  dayStartHour,
  onClose,
  onSaved,
}: {
  draft: FormDraft
  categories: Category[]
  tags: Tag[]
  dayStartHour: number
  onClose: () => void
  onSaved: (entry: Entry, isNew: boolean) => void
}) {
  const defs = useLive(getDefs, [])
  const typeOptions = entryTypeOptions(defs, true).filter(
    (t) => !defs?.customTypes?.some((c) => c.id === t.id && c.archived) || t.id === draft.type,
  )
  const [type, setType] = useState(draft.type)
  const [categoryId, setCategoryId] = useState(draft.categoryId)
  const [pickCategory, setPickCategory] = useState(!draft.categoryId)
  const [start, setStart] = useState(toHHmm(draft.start))
  const [end, setEnd] = useState(draft.end ? toHHmm(draft.end) : '')
  const [value, setValue] = useState(draft.value?.toString() ?? '')
  const [unit, setUnit] = useState(draft.unit)
  const [note, setNote] = useState(draft.note)
  const [payload, setPayload] = useState<Payload>(draft.payload ?? {})
  const [tagIds, setTagIds] = useState<string[]>(draft.tags ?? [])
  const [newTag, setNewTag] = useState('')
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
  const typedEnd = end ? atTime(draft.dateKey, end, dayStartHour) : null
  const endIso = typedEnd ? resolveEnd(startIso, typedEnd) : null
  const durationMin = endIso
    ? Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000)
    : null
  const overlaps = findOverlaps(history, type, startIso, endIso, draft.id)

  const cats = categories.filter((c) => c.entryType === type && !c.archived)
  const category = categories.find((c) => c.id === categoryId)
  // The title follows the category; an old entry keeps the title it was given.
  const keepTitle = draft.title !== '' && type === draft.type && categoryId === draft.categoryId
  const title = keepTitle ? draft.title : (category?.name ?? typeLabel(defs, type))
  // Pressing a shortcut on Hôm nay starts a block: without an end time it waits for "Kết thúc".
  const startsBlock = !draft.id && draft.source === 'quick' && isTimedType(type) && !endIso

  const save = async () => {
    if (typedEnd && !endIso) return setError('Khối dài quá 16 giờ, kiểm tra lại giờ kết thúc.')
    const num = value.trim() === '' ? null : Number(value.replace(',', '.'))
    if (num !== null && Number.isNaN(num)) return setError('Giá trị không hợp lệ.')
    const fields = {
      type,
      categoryId,
      title,
      value: num,
      unit: unit.trim(),
      note: note.trim(),
      start: startIso,
      end: endIso,
      photoIds,
      tags: tagIds,
      payload:
        type === 'meal' && !payload.mealSlot
          ? { ...payload, mealSlot: autoMealSlot(categoryId, start) }
          : startsBlock
            ? startRunning(payload)
            : stopRunning(payload),
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
        {pickCategory ? (
          <>
            <label>
              Loại
              <select
                value={type}
                onChange={(e) => {
                  setType(e.currentTarget.value as EntryType)
                  setCategoryId('')
                }}
              >
                {typeOptions.map((t) => (
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
          </>
        ) : (
          <div class="formhead">
            <span class="ico">{category?.icon}</span>
            <span>
              <b>{category?.name}</b>
              <span class="muted"> · {typeLabel(defs, type)}</span>
            </span>
            <button type="button" class="btn small" onClick={() => setPickCategory(true)}>
              Đổi
            </button>
          </div>
        )}
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
        <div class="field">
          <span class="lbl">
            Ước lượng thời lượng{durationMin ? `: ${formatDuration(durationMin)}` : ''}
          </span>
          <div class="choice">
            {DURATION_CHOICES.map((m) => (
              <button
                type="button"
                class={durationMin === m ? 'on' : ''}
                onClick={() => setEnd(toHHmm(addMinutes(startIso, m)))}
              >
                {formatDuration(m)}
              </button>
            ))}
            {end && (
              <button type="button" onClick={() => setEnd('')}>
                Không có giờ kết thúc
              </button>
            )}
          </div>
        </div>
        {startsBlock && (
          <p class="muted hint">
            Để trống giờ kết thúc: việc chạy tiếp, bấm "Kết thúc" ở Hôm nay khi xong.
          </p>
        )}
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
        <div class="field">
          <span class="lbl">Tag</span>
          <div class="choice">
            {tags.map((t) => (
              <button
                type="button"
                class={tagIds.includes(t.id) ? 'on' : ''}
                onClick={() =>
                  setTagIds((ids) =>
                    ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id],
                  )
                }
              >
                {t.name}
              </button>
            ))}
            <input
              class="newtag"
              placeholder="+ tag mới"
              value={newTag}
              onInput={(e) => setNewTag(e.currentTarget.value)}
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const name = newTag.trim()
                if (!name) return
                const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
                const tag = existing ?? { id: newId('tag'), name, color: '#6c6c70' }
                if (!existing) {
                  const defs = await getDefs()
                  await saveDefs({ ...defs, tags: [...defs.tags, tag] })
                }
                setTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]))
                setNewTag('')
              }}
            />
          </div>
        </div>
        <PayloadFields
          type={type}
          payload={payload}
          set={setField}
          projects={projectNames(history)}
        />
        <label>
          Ghi chú
          <textarea rows={2} value={note} onInput={(e) => setNote(e.currentTarget.value)} />
        </label>
        {error && <p class="error">{error}</p>}
        <div class="row">
          <button type="button" class="btn" onClick={close}>
            Huỷ
          </button>
          <button type="submit" class="btn btn-primary">
            {startsBlock ? 'Bắt đầu' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>
  )
}

const DEFAULT_PROJECTS = ['CyberApp Golden', 'QLBX', 'Nhật ký']

/** Project names for the suggestion list: the ones used before (most used first), then the defaults. */
function projectNames(history: Entry[]): string[] {
  const count = new Map<string, number>()
  for (const e of history) {
    const p = e.payload.project
    if (typeof p === 'string' && p.trim()) count.set(p.trim(), (count.get(p.trim()) ?? 0) + 1)
  }
  const used = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  return [...used, ...DEFAULT_PROJECTS.filter((p) => !count.has(p))]
}
