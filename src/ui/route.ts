export const TABS = [
  { id: 'today', label: 'Hôm nay', icon: '●' },
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
