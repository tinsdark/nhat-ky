import { useEffect, useRef, useState } from 'preact/hooks'
import {
  entryTypeOptions,
  moveItem,
  newCustomType,
  newId,
  nextOrder,
  removeQuickAction,
  setArchived,
  typeLabel,
  upsertById,
  validateQuickAction,
} from '../core/defs'
import type { Category, CustomType, Defs, EntryType, QuickAction, Tag } from '../core/types'
import { getDefs, saveDefs } from '../data/repository'
import { Choice } from './Choice'
import { useLive } from './useLive'

type Tab = 'cat' | 'quick' | 'tag' | 'type'

/** Full-screen editor for categories, quick buttons and tags (SPEC 9.1). */
export function ManageDefs({
  onClose,
  initialTab = 'quick',
  startNew = false,
}: {
  onClose: () => void
  initialTab?: Tab
  /** Open the "new quick button" editor straight away (the "+ Thêm" tile on Hôm nay). */
  startNew?: boolean
}) {
  const defs = useLive(getDefs, [])
  const [tab, setTab] = useState<Tab>(initialTab)
  const openedNew = useRef(false)
  const [editing, setEditing] = useState<{
    kind: Tab
    item: Category | QuickAction | Tag | CustomType
  } | null>(null)
  useEffect(() => {
    if (!startNew || !defs || openedNew.current) return
    openedNew.current = true
    setEditing({
      kind: 'quick',
      item: {
        id: newId('qa'),
        name: '',
        icon: '⭐',
        order: nextOrder(defs.quickActions),
        type: 'activity',
        categoryId: '',
        title: '',
        value: null,
        unit: '',
      },
    })
  }, [defs, startNew])
  if (!defs) return null
  const save = (next: Defs) => void saveDefs(next)

  return (
    <div class="fullscreen">
      <div class="topbar">
        <strong>Danh mục, nút nhanh, tag</strong>
        <button type="button" class="btn" onClick={onClose}>
          Xong
        </button>
      </div>
      <div class="content">
        <Choice
          label=""
          options={[
            { id: 'quick', label: 'Nút nhanh' },
            { id: 'cat', label: 'Danh mục' },
            { id: 'type', label: 'Loại' },
            { id: 'tag', label: 'Tag' },
          ]}
          value={tab}
          onChange={(v) => v && setTab(v)}
        />

        {tab === 'quick' && (
          <>
            <ul class="habits">
              {[...defs.quickActions]
                .sort((a, b) => a.order - b.order)
                .map((a) => (
                  <li class="habit">
                    <div class="habit-main">
                      <button
                        type="button"
                        class="habit-name"
                        onClick={() => setEditing({ kind: 'quick', item: a })}
                      >
                        <strong>
                          {a.icon} {a.name}
                        </strong>
                        <span class="muted">{typeLabel(defs, a.type)}</span>
                      </button>
                      <div class="mini">
                        <button
                          type="button"
                          aria-label="Lên"
                          onClick={() =>
                            save({ ...defs, quickActions: moveItem(defs.quickActions, a.id, -1) })
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Xuống"
                          onClick={() =>
                            save({ ...defs, quickActions: moveItem(defs.quickActions, a.id, 1) })
                          }
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
            <button
              type="button"
              class="btn btn-primary block-btn"
              onClick={() =>
                setEditing({
                  kind: 'quick',
                  item: {
                    id: newId('qa'),
                    name: '',
                    icon: '⭐',
                    order: nextOrder(defs.quickActions),
                    type: 'activity',
                    categoryId: '',
                    title: '',
                    value: null,
                    unit: '',
                  },
                })
              }
            >
              + Nút nhanh mới
            </button>
          </>
        )}

        {tab === 'cat' && (
          <>
            <ul class="habits">
              {[...defs.categories]
                .sort((a, b) => a.order - b.order)
                .map((c) => (
                  <li class={c.archived ? 'habit archived' : 'habit'}>
                    <div class="habit-main">
                      <button
                        type="button"
                        class="habit-name"
                        onClick={() => setEditing({ kind: 'cat', item: c })}
                      >
                        <strong>
                          <span class="swatch" style={{ background: c.color }} /> {c.icon} {c.name}
                        </strong>
                        <span class="muted">
                          {typeLabel(defs, c.entryType)}
                          {c.archived ? ' · đã ẩn' : ''}
                        </span>
                      </button>
                      <div class="mini">
                        <button
                          type="button"
                          aria-label="Lên"
                          onClick={() =>
                            save({ ...defs, categories: moveItem(defs.categories, c.id, -1) })
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Xuống"
                          onClick={() =>
                            save({ ...defs, categories: moveItem(defs.categories, c.id, 1) })
                          }
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
            <button
              type="button"
              class="btn btn-primary block-btn"
              onClick={() =>
                setEditing({
                  kind: 'cat',
                  item: {
                    id: newId('cat'),
                    name: '',
                    entryType: 'activity',
                    color: '#3b4a9e',
                    icon: '📌',
                    order: nextOrder(defs.categories),
                    archived: false,
                  },
                })
              }
            >
              + Danh mục mới
            </button>
            <p class="muted hint">
              Danh mục đã có dữ liệu không xoá được, chỉ ẩn đi để thống kê cũ không mất tên.
            </p>
          </>
        )}

        {tab === 'type' && (
          <>
            <ul class="habits">
              {entryTypeOptions(null).map((t) => (
                <li class="habit archived">
                  <div class="habit-main">
                    <span class="habit-name">
                      <strong>{t.label}</strong>
                      <span class="muted">có sẵn, có form và chỉ số riêng</span>
                    </span>
                  </div>
                </li>
              ))}
              {(defs.customTypes ?? []).map((t) => (
                <li class={t.archived ? 'habit archived' : 'habit'}>
                  <div class="habit-main">
                    <button
                      type="button"
                      class="habit-name"
                      onClick={() => setEditing({ kind: 'type', item: t })}
                    >
                      <strong>
                        {t.icon} {t.name}
                      </strong>
                      <span class="muted">{t.archived ? 'đã ẩn' : 'tự đặt'}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              class="btn btn-primary block-btn"
              onClick={() => setEditing({ kind: 'type', item: newCustomType('', '📌') })}
            >
              + Loại mới
            </button>
            <p class="muted hint">
              Loại tự đặt dùng form cơ bản (giờ, giá trị, đơn vị, ghi chú, tag) và không có chỉ số
              tự động. Loại đã dùng không xoá được, chỉ ẩn đi.
            </p>
          </>
        )}

        {tab === 'tag' && (
          <>
            <ul class="habits">
              {defs.tags.map((t) => (
                <li class="habit">
                  <div class="habit-main">
                    <button
                      type="button"
                      class="habit-name"
                      onClick={() => setEditing({ kind: 'tag', item: t })}
                    >
                      <strong>
                        <span class="swatch" style={{ background: t.color }} /> {t.name}
                      </strong>
                    </button>
                  </div>
                </li>
              ))}
              {defs.tags.length === 0 && (
                <p class="muted">
                  Chưa có tag nào. Tag dùng để gắn nhãn Entry, ví dụ "ăn ngoài", "OT".
                </p>
              )}
            </ul>
            <button
              type="button"
              class="btn btn-primary block-btn"
              onClick={() =>
                setEditing({ kind: 'tag', item: { id: newId('tag'), name: '', color: '#6c6c70' } })
              }
            >
              + Tag mới
            </button>
          </>
        )}
      </div>

      {editing && (
        <DefEditor
          kind={editing.kind}
          item={editing.item}
          defs={defs}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            save(next)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function DefEditor({
  kind,
  item,
  defs,
  onClose,
  onSave,
}: {
  kind: Tab
  item: Category | QuickAction | Tag | CustomType
  defs: Defs
  onClose: () => void
  onSave: (d: Defs) => void
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...item })
  const [error, setError] = useState('')
  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }))
  const str = (k: string) => String(draft[k] ?? '')

  const submit = () => {
    if (str('name').trim() === '') return setError('Nhập tên.')
    if (kind === 'cat') {
      const c = { ...draft, name: str('name').trim() } as unknown as Category
      return onSave({ ...defs, categories: upsertById(defs.categories, c) })
    }
    if (kind === 'type') {
      const t = { ...draft, name: str('name').trim() } as unknown as CustomType
      return onSave({ ...defs, customTypes: upsertById(defs.customTypes ?? [], t) })
    }
    if (kind === 'tag') {
      const t = { ...draft, name: str('name').trim() } as unknown as Tag
      return onSave({ ...defs, tags: upsertById(defs.tags, t) })
    }
    const value = str('value').trim() === '' ? null : Number(str('value').replace(',', '.'))
    if (value !== null && Number.isNaN(value)) return setError('Giá trị không hợp lệ.')
    const a = {
      ...draft,
      name: str('name').trim(),
      title: str('title').trim() || str('name').trim(),
      value,
    } as unknown as QuickAction
    const problem = validateQuickAction(a, defs.categories)
    if (problem) return setError(problem)
    onSave({ ...defs, quickActions: upsertById(defs.quickActions, a) })
  }

  const type = (draft.type ?? draft.entryType) as EntryType
  const exists =
    kind === 'quick'
      ? defs.quickActions.some((q) => q.id === item.id)
      : kind === 'cat'
        ? defs.categories.some((c) => c.id === item.id)
        : kind === 'type'
          ? (defs.customTypes ?? []).some((t) => t.id === item.id)
          : defs.tags.some((t) => t.id === item.id)

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <form
        class="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h2>{exists ? 'Sửa' : 'Thêm'}</h2>
        <label>
          Tên
          <input value={str('name')} onInput={(e) => set('name', e.currentTarget.value)} />
        </label>
        {kind !== 'tag' && (
          <label>
            Biểu tượng (emoji)
            <input value={str('icon')} onInput={(e) => set('icon', e.currentTarget.value)} />
          </label>
        )}
        {kind !== 'quick' && kind !== 'type' && (
          <label>
            Màu
            <input
              type="color"
              value={str('color') || '#3b4a9e'}
              onInput={(e) => set('color', e.currentTarget.value)}
            />
          </label>
        )}
        {kind !== 'tag' && kind !== 'type' && (
          <label>
            Loại
            <select
              value={type}
              onChange={(e) => {
                set(kind === 'cat' ? 'entryType' : 'type', e.currentTarget.value)
                if (kind === 'quick') set('categoryId', '')
              }}
            >
              {entryTypeOptions(defs).map((t) => (
                <option value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
        )}
        {kind === 'cat' && (
          <label>
            Nhóm thời gian
            <select
              value={str('group') || 'auto'}
              onChange={(e) =>
                set('group', e.currentTarget.value === 'auto' ? undefined : e.currentTarget.value)
              }
            >
              <option value="auto">Tự động theo loại</option>
              <option value="work">Công việc chính</option>
              <option value="growth">Phát triển bản thân</option>
              <option value="personal">Cá nhân</option>
            </select>
          </label>
        )}
        {kind === 'quick' && (
          <>
            <label>
              Danh mục
              <select
                value={str('categoryId')}
                onChange={(e) => set('categoryId', e.currentTarget.value)}
              >
                <option value="">—</option>
                {defs.categories
                  .filter((c) => c.entryType === type && !c.archived)
                  .map((c) => (
                    <option value={c.id}>{c.name}</option>
                  ))}
              </select>
            </label>
            <label>
              Nội dung ghi sẵn
              <input value={str('title')} onInput={(e) => set('title', e.currentTarget.value)} />
            </label>
            <div class="row">
              <label>
                Giá trị mặc định
                <input
                  inputMode="decimal"
                  value={str('value')}
                  onInput={(e) => set('value', e.currentTarget.value)}
                />
              </label>
              <label>
                Đơn vị
                <input value={str('unit')} onInput={(e) => set('unit', e.currentTarget.value)} />
              </label>
            </div>
          </>
        )}
        {error && <p class="error">{error}</p>}
        <div class="row">
          {kind === 'cat' && exists && (
            <button
              type="button"
              class="btn"
              onClick={() =>
                onSave({
                  ...defs,
                  categories: setArchived(defs.categories, item.id, !(item as Category).archived),
                })
              }
            >
              {(item as Category).archived ? 'Hiện lại' : 'Ẩn'}
            </button>
          )}
          {kind === 'quick' && exists && (
            <button
              type="button"
              class="btn btn-danger"
              onClick={() => onSave(removeQuickAction(defs, item.id))}
            >
              Xoá
            </button>
          )}
          {kind === 'type' && exists && (
            <button
              type="button"
              class="btn"
              onClick={() =>
                onSave({
                  ...defs,
                  customTypes: (defs.customTypes ?? []).map((t) =>
                    t.id === item.id ? { ...t, archived: !(item as CustomType).archived } : t,
                  ),
                })
              }
            >
              {(item as CustomType).archived ? 'Hiện lại' : 'Ẩn'}
            </button>
          )}
          {kind === 'tag' && exists && (
            <button
              type="button"
              class="btn btn-danger"
              onClick={() => onSave({ ...defs, tags: defs.tags.filter((t) => t.id !== item.id) })}
            >
              Xoá
            </button>
          )}
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
