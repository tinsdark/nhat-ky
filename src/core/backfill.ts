import type { QuickAction } from './types'

export interface BackfillDefaults {
  /** HH:mm start and the estimated length in minutes (null = a single moment, no end). */
  start: string
  minutes: number | null
}

const BY_CATEGORY: Record<string, BackfillDefaults> = {
  'cat-breakfast': { start: '07:30', minutes: null },
  'cat-lunch': { start: '12:00', minutes: null },
  'cat-dinner': { start: '19:00', minutes: null },
  'cat-snack': { start: '15:30', minutes: null },
  'cat-drink': { start: '09:00', minutes: null },
  'cat-outdoor': { start: '07:00', minutes: 15 },
  'cat-sleep': { start: '23:30', minutes: 7 * 60 + 30 },
}

const BY_TYPE: Record<string, BackfillDefaults> = {
  work: { start: '09:00', minutes: 120 },
  study: { start: '20:00', minutes: 60 },
  exercise: { start: '18:00', minutes: 30 },
  water: { start: '10:00', minutes: null },
  activity: { start: '20:00', minutes: 60 },
  sleep: { start: '23:30', minutes: 7 * 60 + 30 },
}

/** Time to propose for a backfilled item: where the user usually does it, so one tap on Lưu is often enough. */
export function backfillDefaults(
  action: Pick<QuickAction, 'type' | 'categoryId'>,
  fallbackStart: string,
): BackfillDefaults {
  return (
    BY_CATEGORY[action.categoryId] ??
    BY_TYPE[action.type] ?? { start: fallbackStart, minutes: null }
  )
}

/** Rounds `HH:mm` down to 5 minutes, for a neutral default start. */
export function roundHHmm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return `${String(h).padStart(2, '0')}:${String(m - (m % 5)).padStart(2, '0')}`
}
