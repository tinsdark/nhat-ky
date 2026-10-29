import { DEFAULT_QUICK_ACTIONS } from '../core/defaults'
import type { QuickAction } from '../core/types'
import { Icon, type IconName } from './Icon'

/** Drawn glyphs for the built-in buttons; a button whose emoji was changed or that the user made keeps its emoji. */
const DRAWN: Record<string, IconName> = {
  'qa-wake': 'sun',
  'qa-sleep': 'moon',
  'qa-meal': 'meal',
  'qa-work': 'work',
  'qa-activity': 'activity',
  'qa-exercise': 'exercise',
  'qa-water': 'water',
}

export function QuickIcon({ action, size = 24 }: { action: QuickAction; size?: number }) {
  const isDefault = DEFAULT_QUICK_ACTIONS.some((d) => d.id === action.id && d.icon === action.icon)
  const name = isDefault ? DRAWN[action.id] : undefined
  return name ? <Icon name={name} size={size} /> : <>{action.icon}</>
}
