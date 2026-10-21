import { addDays, toDateKey, toHHmm } from './date'
import type { Day } from './types'

export interface ReviewPrompt {
  dateKey: string
  kind: 'tonight' | 'yesterday'
}

const rated = (day: Day | undefined) => day != null && !day.deleted && day.dayScore != null

/**
 * Which day, if any, to nag about. Tonight's banner shows from `reviewTime` (the small hours before
 * the day rolls over count as still tonight). The morning after, an unrated day that had entries is
 * asked about once; `yesterdayAsked` is the "once" flag kept by the caller.
 */
export function reviewPrompt(input: {
  now: number
  dayStartHour: number
  reviewTime: string
  today: Day | undefined
  yesterday: Day | undefined
  yesterdayHasEntries: boolean
  yesterdayAsked: boolean
}): ReviewPrompt | null {
  const todayKey = toDateKey(input.now, input.dayStartHour)
  const hhmm = toHHmm(input.now)
  const lateEnough = hhmm >= input.reviewTime || Number(hhmm.slice(0, 2)) < input.dayStartHour
  if (lateEnough && !rated(input.today)) return { dateKey: todayKey, kind: 'tonight' }
  if (input.yesterdayHasEntries && !rated(input.yesterday) && !input.yesterdayAsked) {
    return { dateKey: addDays(todayKey, -1), kind: 'yesterday' }
  }
  return null
}
