/** Part of the day that tints the whole app (presentation only; nothing is stored or computed from it). */
export const PERIODS = ['sang', 'trua', 'chieu', 'toi', 'dem'] as const
export type Period = (typeof PERIODS)[number]

export const PERIOD_LABEL: Record<Period, string> = {
  sang: 'Sáng',
  trua: 'Trưa',
  chieu: 'Chiều',
  toi: 'Tối',
  dem: 'Đêm',
}

/** Local hour (0-23) → part of the day: sáng 5-10h, trưa 10-14h, chiều 14-18h, tối 18-22h, đêm 22-5h. */
export function periodOf(hour: number): Period {
  if (hour >= 5 && hour < 10) return 'sang'
  if (hour >= 10 && hour < 14) return 'trua'
  if (hour >= 14 && hour < 18) return 'chieu'
  if (hour >= 18 && hour < 22) return 'toi'
  return 'dem'
}
