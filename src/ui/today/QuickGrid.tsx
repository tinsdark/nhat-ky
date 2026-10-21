import { useRef } from 'preact/hooks'
import type { Category, QuickAction } from '../../core/types'
import { Icon } from '../Icon'

const LONG_PRESS_MS = 500

/**
 * Quick buttons as tiles: the icon sits in a circle tinted with its category colour. Tap = pick what happened
 * (water records at once). "Sửa" opens the editor, the last tile adds a new button.
 */
export function QuickGrid({
  actions,
  categories,
  onTap,
  onHold,
  onEdit,
  onAdd,
}: {
  actions: QuickAction[]
  categories: Category[]
  onTap: (a: QuickAction) => void
  onHold: (a: QuickAction) => void
  onEdit: () => void
  onAdd: () => void
}) {
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>Ghi nhanh</h2>
        <button type="button" class="btn small" onClick={onEdit}>
          <Icon name="edit" size={14} /> Sửa
        </button>
      </div>
      <div class="quickgrid">
        {actions.map((a) => (
          <Tile
            action={a}
            color={
              (
                categories.find((c) => c.id === a.categoryId) ??
                categories.find((c) => c.entryType === a.type)
              )?.color
            }
            onTap={() => onTap(a)}
            onHold={() => onHold(a)}
          />
        ))}
        <button type="button" class="quick add" onClick={onAdd}>
          <span class="ico">
            <Icon name="plus" size={22} />
          </span>
          Thêm nút
        </button>
      </div>
      <p class="muted hint">
        Chạm để chọn việc, Uống nước thì ghi ngay. Việc kéo dài thì bấm Bắt đầu, xong bấm Kết thúc.
      </p>
    </section>
  )
}

function Tile({
  action,
  color,
  onTap,
  onHold,
}: {
  action: QuickAction
  color: string | undefined
  onTap: () => void
  onHold: () => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const held = useRef(false)
  const clear = () => clearTimeout(timer.current)
  return (
    <button
      type="button"
      class="quick"
      onPointerDown={() => {
        held.current = false
        timer.current = setTimeout(() => {
          held.current = true
          onHold()
        }, LONG_PRESS_MS)
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!held.current) onTap()
      }}
    >
      <span
        class="ico"
        style={color ? { background: `color-mix(in srgb, ${color} 22%, var(--card))` } : undefined}
      >
        {action.icon}
      </span>
      {action.name}
    </button>
  )
}
