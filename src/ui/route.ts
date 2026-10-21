import type { IconName } from './Icon'

export const TABS = [
  { id: 'today', label: 'Hôm nay', icon: 'clock' },
  { id: 'backfill', label: 'Ghi bù', icon: 'edit' },
  { id: 'habits', label: 'Thói quen', icon: 'checkCircle' },
  { id: 'stats', label: 'Thống kê', icon: 'bars' },
  { id: 'settings', label: 'Cài đặt', icon: 'sliders' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[]

export type TabId = (typeof TABS)[number]['id']

/** '#/habits' → 'habits'. Unknown or empty hash falls back to 'today'. */
export function parseHash(hash: string): TabId {
  const id = hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  return TABS.find((t) => t.id === id)?.id ?? 'today'
}

/** Query part of a hash: `#/backfill?d=2026-11-02&s=09:00` → { d, s }. */
export function parseHashQuery(hash: string): Record<string, string> {
  const q = hash.split('?')[1]
  return q ? Object.fromEntries(new URLSearchParams(q)) : {}
}
