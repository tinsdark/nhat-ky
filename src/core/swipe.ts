// Row swipe, as on iPhone and in Sổ Chi Tiêu: left = delete, right = edit. Pure maths; the touch handling
// lives in ui/SwipeRow.tsx.

/** Distance in px the finger must travel before we decide between scrolling and swiping. */
export const SWIPE_LOCK_PX = 10

/** The swipe commits once it is 30% of the row wide, but never needs more than 110px. */
export const swipeThreshold = (rowWidth: number): number => Math.min(110, rowWidth * 0.3)

export type Axis = 'undecided' | 'horizontal' | 'vertical'

/** A swipe must be clearly sideways (1.5x), otherwise it is a scroll and the row must not move. */
export function classifyAxis(dx: number, dy: number): Axis {
  if (Math.abs(dx) <= SWIPE_LOCK_PX && Math.abs(dy) <= SWIPE_LOCK_PX) return 'undecided'
  return Math.abs(dx) > Math.abs(dy) * 1.5 ? 'horizontal' : 'vertical'
}

export interface SwipeState {
  /** What letting go now would do. */
  intent: 'delete' | 'edit' | 'none'
  /** 0 to 1, how close to the threshold. */
  progress: number
  passed: boolean
}

export function swipeIntent(dx: number, rowWidth: number): SwipeState {
  const need = swipeThreshold(rowWidth)
  const passed = Math.abs(dx) >= need && dx !== 0
  return {
    intent: !passed ? 'none' : dx < 0 ? 'delete' : 'edit',
    progress: Math.min(1, Math.abs(dx) / need),
    passed,
  }
}
