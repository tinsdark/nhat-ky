import { useEffect, useRef, useState } from 'preact/hooks'
import {
  applyDefDraft,
  entryTypeOptions,
  NEW_QUICK_TYPE,
  moveItem,
  newCustomType,
  newId,
  nextOrder,
  removeQuickAction,
  setArchived,
  typeLabel,
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

  const addNew: Record<
    Tab,
    { label: string; item: () => Category | QuickAction | Tag | CustomType }
  > = {
    quick: {
      label: '+ Nút nhanh mới',
      item: () => ({
        id: newId('qa'),
        name: '',
        icon: '⭐',
        order: nextOrder(defs.quickActions),
        type: 'activity',
        categoryId: '',
        title: '',
        value: null,
        unit: '',
      }),
    },
    cat: {
      label: '+ Danh mục mới',
      item: () => ({
        id: newId('cat'),
        name: '',
        entryType: 'activity',
        color: '#3b4a9e',
        icon: '📌',
        order: nextOrder(defs.categories),
        archived: false,
      }),
    },
    type: { label: '+ Loại mới', item: () => newCustomType('', '📌') },
    tag: { label: '+ Tag mới', item: () => ({ id: newId('tag'), name: '', color: '#6c6c70' }) },
  }

  return (
    <>
      <div class="fullscreen manage">
        <div class="topbar">
          <strong>Danh mục, nút nhanh, tag</strong>
          <button type="button" class="btn" onClick={onClose}>
            Xong
          </button>
        </div>
        <div class="manage-tabs">
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
        </div>
        <div class="manage-body">
          <div class="content">
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
                                save({
                                  ...defs,
                                  quickActions: moveItem(defs.quickActions, a.id, -1),
                                })
                              }
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              aria-label="Xuống"
                              onClick={() =>
                                save({
                                  ...defs,
                                  quickActions: moveItem(defs.quickActions, a.id, 1),
                                })
                              }
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
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
                              <span class="swatch" style={{ background: c.color }} /> {c.icon}{' '}
                              {c.name}
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
                <p class="muted hint">
                  Loại tự đặt dùng form cơ bản (giờ, giá trị, đơn vị, ghi chú, tag) và không có chỉ
                  số tự động. Loại đã dùng không xoá được, chỉ ẩn đi.
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
                      Chưa có tag nào. Tag dùng để gắn nhãn cho bản ghi, ví dụ "ăn ngoài", "tăng
                      ca".
                    </p>
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
        <div class="manage-add">
          <button
            type="button"
            class="btn btn-primary block-btn"
            onClick={() => setEditing({ kind: tab, item: addNew[tab].item() })}
          >
            {addNew[tab].label}
          </button>
        </div>
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
    </>
  )
}

/** Select value for "make a new type named like this button". */

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
    const result = applyDefDraft(kind, draft, defs)
    if ('error' in result) return setError(result.error)
    onSave(result.defs)
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
    <div class="sheet-backdrop above" onClick={onClose}>
      <form
        class="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h2>
          {exists ? 'Sửa' : 'Thêm'}{' '}
          {{ quick: 'nút nhanh', cat: 'danh mục', type: 'loại', tag: 'tag' }[kind]}
        </h2>
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
                if (kind === 'quick') {
                  set('categoryId', '')
                  set('categoryIds', undefined)
                }
              }}
            >
              {entryTypeOptions(defs).map((t) => (
                <option value={t.id}>{t.label}</option>
              ))}
              {kind === 'quick' && <option value={NEW_QUICK_TYPE}>+ Loại mới (tên như nút)</option>}
            </select>
          </label>
        )}
        {kind === 'quick' && (
          <p class="muted hint">
            {str('type') === NEW_QUICK_TYPE
              ? `Tạo Loại "${str('name').trim() || '…'}". Thêm danh mục cho loại này ở tab Danh mục.`
              : 'Bấm nút ở Hôm nay sẽ hiện các danh mục của loại này để chọn.'}
          </p>
        )}
        {kind === 'quick' && type !== 'water' && str('type') !== NEW_QUICK_TYPE && (
          <div class="field">
            <span class="lbl">Danh mục hiện khi bấm nút</span>
            <div class="choice">
              {defs.categories
                .filter((c) => c.entryType === type && !c.archived)
                .sort((a, b) => a.order - b.order)
                .map((c) => {
                  const ids = (draft.categoryIds as string[] | undefined) ?? []
                  const on = ids.length === 0 || ids.includes(c.id)
                  return (
                    <button
                      type="button"
                      class={on ? 'on' : ''}
                      aria-pressed={on}
                      onClick={() => {
                        const own = defs.categories.filter(
                          (x) => x.entryType === type && !x.archived,
                        )
                        const base = ids.length === 0 ? own.map((x) => x.id) : ids
                        set('categoryIds', on ? base.filter((i) => i !== c.id) : [...base, c.id])
                      }}
                    >
                      {c.icon} {c.name}
                    </button>
                  )
                })}
            </div>
            <span class="muted hint">
              Bỏ chọn danh mục không liên quan; chọn hết = hiện tất cả.
            </span>
          </div>
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
        {kind === 'quick' && type === 'water' && (
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
