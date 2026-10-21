export const TABS = [
  { id: 'today', label: 'Hôm nay', icon: '●' },
  { id: 'backfill', label: 'Ghi bù', icon: '✎' },
  { id: 'habits', label: 'Thói quen', icon: '✓' },
  { id: 'stats', label: 'Thống kê', icon: '▤' },
  { id: 'settings', label: 'Cài đặt', icon: '⚙' },
] as const

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
