import type { Entry } from './types'

/** Amounts offered when "Uống nước" is pressed, in ml; editable in Settings. */
export const DEFAULT_WATER_SIZES = [150, 250, 330, 500, 750]

const MIN_ML = 10
const MAX_ML = 3000

/** "150, 250 500" → [150, 250, 500]; null unless 2–8 distinct amounts between 10 and 3000 ml. */
export function parseWaterSizes(text: string): number[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean)
  const nums = parts.map(Number)
  if (nums.some((n) => !Number.isInteger(n) || n < MIN_ML || n > MAX_ML)) return null
  const sizes = [...new Set(nums)].sort((a, b) => a - b)
  return sizes.length >= 2 && sizes.length <= 8 ? sizes : null
}

export const formatWaterSizes = (sizes: number[]) => sizes.join(', ')

/** Amount of the newest live water entry, so the picker can highlight what was drunk last. */
export function lastWaterMl(entries: Entry[]): number | null {
  let best: Entry | null = null
  for (const e of entries) {
    if (e.type !== 'water' || e.deleted || e.value === null) continue
    if (!best || e.start > best.start) best = e
  }
  return best?.value ?? null
}

/** 750 → "750 ml", 1750 → "1,75 L". */
export function formatMl(ml: number): string {
  if (ml < 1000) return `${ml} ml`
  return `${String(Math.round(ml) / 1000).replace('.', ',')} L`
}
