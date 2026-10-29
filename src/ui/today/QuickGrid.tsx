import { useRef } from 'preact/hooks'
import { DEFAULT_QUICK_ACTIONS } from '../../core/defaults'
import type { Category, QuickAction } from '../../core/types'
import { Icon, type IconName } from '../Icon'

const LONG_PRESS_MS = 500

/** Drawn glyphs for the built-in buttons; a button whose emoji was changed or that the user made keeps its emoji. */
const DRAWN: Record<string, IconName> = {
  'qa-meal': 'meal',
  'qa-work': 'work',
  'qa-activity': 'activity',
  'qa-exercise': 'exercise',
  'qa-water': 'water',
}
const drawnIcon = (a: QuickAction): IconName | undefined =>
  DEFAULT_QUICK_ACTIONS.find((d) => d.id === a.id && d.icon === a.icon) && DRAWN[a.id]

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
  const drawn = drawnIcon(action)
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
        aria-hidden="true"
        style={color ? { background: `color-mix(in srgb, ${color} 28%, var(--card))` } : undefined}
      >
        {drawn ? <Icon name={drawn} size={24} /> : action.icon}
      </span>
      {action.name}
    </button>
  )
}
