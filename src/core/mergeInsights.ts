import type { InsightStore } from './types'

const byIdNewest = <T extends { id: string; updatedAt: string }>(a: T[], b: T[]): T[] => {
  const out = new Map(a.map((x) => [x.id, x]))
  for (const x of b) {
    const cur = out.get(x.id)
    if (!cur || x.updatedAt > cur.updatedAt) out.set(x.id, x)
  }
  return [...out.values()]
}

const union = <T extends { id: string }>(winner: T[], loser: T[]): T[] => {
  const ids = new Set(winner.map((x) => x.id))
  return [...winner, ...loser.filter((x) => !ids.has(x.id))]
}

/**
 * Two devices changed nk_insights.json apart. Each insight keeps its own newest version (feedback such
 * as Hữu ích / Ẩn 2 tuần made on either device survives); experiments and Claude notes only seen on one
 * side are kept; the newer file (`winner`) decides weights and shared experiments.
 */
export function mergeInsights(winner: InsightStore, loser: InsightStore): InsightStore {
  const lastRun = [winner.lastRunDate, loser.lastRunDate].filter((d): d is string => !!d).sort()
  return {
    ...winner,
    items: byIdNewest(winner.items ?? [], loser.items ?? []),
    experiments: union(winner.experiments ?? [], loser.experiments ?? []),
    claudeNotes: union(winner.claudeNotes ?? [], loser.claudeNotes ?? []),
    lastRunDate: lastRun[lastRun.length - 1] ?? null,
  }
}
