import type { Defs } from './types'

const withExtras = <T extends { id: string }>(winner: T[], loser: T[]): T[] => {
  const ids = new Set(winner.map((x) => x.id))
  const extra = loser.filter((x) => !ids.has(x.id))
  return extra.length ? [...winner, ...extra] : winner
}

/**
 * Two devices edited defs apart: the newer file (`winner`) decides every shared item, but categories,
 * habits and custom types that exist only in the other file are kept. Those are archived, never deleted,
 * so an item missing on one side is a new one, not a removal. Quick actions and tags can be deleted
 * for real, so the winner's list is taken as is. Returns `winner` itself when nothing was added.
 */
export function mergeDefs(winner: Defs, loser: Defs): Defs {
  const categories = withExtras(winner.categories, loser.categories)
  const habits = withExtras(winner.habits, loser.habits)
  const winnerTypes = winner.customTypes ?? []
  const customTypes = withExtras(winnerTypes, loser.customTypes ?? [])
  const added =
    categories !== winner.categories || habits !== winner.habits || customTypes !== winnerTypes
  return added ? { ...winner, categories, habits, customTypes } : winner
}
