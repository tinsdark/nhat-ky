import type { RefObject } from 'preact'
import { useLayoutEffect } from 'preact/hooks'
import { mostReadable, parseColor } from '../core/contrast'

/**
 * Sets the text colour of every `[data-readable]` cell inside `ref` to whichever of --fg,
 * --on-accent, black or white reads best on the cell's computed background. Needed where the fill is a data-driven mix
 * of the accent, which changes with the part of the day and the theme, so no fixed cut-off works.
 */
export function useReadableText(ref: RefObject<HTMLElement | null>, deps: unknown[]): void {
  useLayoutEffect(() => {
    const apply = () => {
      const root = ref.current
      if (!root) return
      const css = getComputedStyle(document.documentElement)
      const candidates = [
        ...['--fg', '--on-accent'].map((v) => css.getPropertyValue(v).trim()),
        '#000000',
        '#ffffff',
      ]
      root.querySelectorAll<HTMLElement>('[data-readable]').forEach((el) => {
        el.style.color = ''
        const bg = parseColor(getComputedStyle(el).backgroundColor)
        if (bg && bg[3] > 0) el.style.color = mostReadable(bg, candidates)
      })
    }
    apply()
    // The palette follows data-period / data-theme on <html> and the device's colour scheme.
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-period', 'data-theme'],
    })
    const dark = matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener('change', apply)
    return () => {
      obs.disconnect()
      dark.removeEventListener('change', apply)
    }
  }, deps)
}
