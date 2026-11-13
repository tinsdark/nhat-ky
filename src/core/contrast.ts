// WCAG contrast arithmetic, for picking readable text on colours only known at run time.

export type Rgba = [number, number, number, number]

/** Parses `#rgb`, `#rrggbb`, `rgb()/rgba()` and `color(srgb …)` (what browsers give for color-mix). */
export function parseColor(c: string): Rgba | null {
  const s = c.trim()
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((x) => x + x).join('') : hex[1]!
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as Rgba
  }
  const rgb = s.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) {
    const p = rgb[1]!
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number)
    return [p[0]!, p[1]!, p[2]!, p[3] ?? 1]
  }
  const srgb = s.match(/^color\(srgb ([^)]+)\)$/)
  if (srgb) {
    const p = srgb[1]!
      .split(/[\s/]+/)
      .filter(Boolean)
      .map(Number)
    return [p[0]! * 255, p[1]! * 255, p[2]! * 255, p[3] ?? 1]
  }
  return null
}

function luminance([r, g, b]: Rgba): number {
  const f = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** The candidate text colour with the highest contrast on `background`. */
export function mostReadable(background: Rgba, candidates: string[]): string {
  let best = candidates[0]!
  let bestRatio = -1
  for (const c of candidates) {
    const rgb = parseColor(c)
    if (!rgb) continue
    const r = contrastRatio(rgb, background)
    if (r > bestRatio) [best, bestRatio] = [c, r]
  }
  return best
}
