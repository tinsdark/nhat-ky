import type { Entry } from '../types'

export const isMeal = (e: Entry) => e.type === 'meal'
export const isDrink = (e: Entry) =>
  isMeal(e) && (Boolean(e.payload.drink) || e.categoryId === 'cat-drink')
/** Solid food: a meal that is not a drink-only entry. */
export const isFood = (e: Entry) => isMeal(e) && !isDrink(e)
export const isCoffee = (e: Entry) =>
  isDrink(e) &&
  (e.payload.drink === 'coffee' || (!e.payload.drink && /cà phê|cafe|coffee/i.test(e.title)))
export const isAlcohol = (e: Entry) => isDrink(e) && e.payload.drink === 'alcohol'
export const slotIs = (e: Entry, slot: string, category: string) =>
  e.payload.mealSlot === slot || e.categoryId === category

export type MainSlot = 'breakfast' | 'lunch' | 'dinner'
const SLOT_CATEGORY: Record<MainSlot, string> = {
  breakfast: 'cat-breakfast',
  lunch: 'cat-lunch',
  dinner: 'cat-dinner',
}

/** First solid meal of a main slot (by `payload.mealSlot` or the slot's category), if any. */
export function mainMeal(entries: Entry[], slot: MainSlot): Entry | undefined {
  return entries.find((e) => isFood(e) && slotIs(e, slot, SLOT_CATEGORY[slot]))
}
