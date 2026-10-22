import type { ComponentChildren } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { classifyAxis, swipeIntent } from '../core/swipe'
import { Icon } from './Icon'

/**
 * A list row you can swipe: left deletes, right edits (the iPhone way). The colour behind the row says
 * what letting go will do. Tapping still works: a swipe never counts as a tap. Touch and pen only,
 * a mouse keeps using the tap-through detail sheet.
 */
export function SwipeRow({
  children,
  onDelete,
  onEdit,
}: {
  children: ComponentChildren
  onDelete: () => void
  onEdit: () => void
}) {
  const front = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: number
    x: number
    y: number
    axis: ReturnType<typeof classifyAxis>
  } | null>(null)
  const swiped = useRef(false)
  const [dx, setDxState] = useState(0)
  // The latest distance, read on release: state updates are applied later than the pointer events.
  const latest = useRef(0)
  const setDx = (v: number) => {
    latest.current = v
    setDxState(v)
  }
  const [dragging, setDragging] = useState(false)

  const width = () => front.current?.offsetWidth ?? 360
  const state = swipeIntent(dx, width())

  const end = (cancelled: boolean) => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    const s = swipeIntent(latest.current, width())
    setDx(0)
    if (!d || d.axis !== 'horizontal') return
    swiped.current = true // the click that follows a swipe is not a tap
    setTimeout(() => (swiped.current = false), 0)
    if (cancelled) return
    if (s.intent === 'delete') onDelete()
    else if (s.intent === 'edit') onEdit()
  }

  return (
    <li class="swipe">
      {dx > 0 && (
        <div class={`swipe-bg edit${state.intent === 'edit' ? ' on' : ''}`} aria-hidden="true">
          <Icon name="edit" size={18} /> {state.intent === 'edit' ? 'Thả để sửa' : 'Sửa'}
        </div>
      )}
      {dx < 0 && (
        <div class={`swipe-bg del${state.intent === 'delete' ? ' on' : ''}`} aria-hidden="true">
          {state.intent === 'delete' ? 'Thả để xoá' : 'Xoá'} <Icon name="trash" size={18} />
        </div>
      )}
      <div
        ref={front}
        class={dragging ? 'swipe-front dragging' : 'swipe-front'}
        style={{ transform: dx === 0 ? undefined : `translateX(${dx}px)` }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' || !e.isPrimary) return
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: 'undecided' }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          const moveX = e.clientX - d.x
          if (d.axis === 'undecided') d.axis = classifyAxis(moveX, e.clientY - d.y)
          if (d.axis !== 'horizontal') return
          if (!dragging) {
            setDragging(true)
            front.current?.setPointerCapture(e.pointerId)
          }
          setDx(moveX)
        }}
        onPointerUp={() => end(false)}
        onPointerCancel={() => end(true)}
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        {children}
      </div>
    </li>
  )
}
