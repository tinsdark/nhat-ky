// Contrast audit: every text node vs the background it actually sits on, for each part of the day
// (data-period) × light/dark × tab. Needs `npm run dev` on :5173 (uses the dev-only sample month).
// Run: node e2e/contrast.cjs [baseUrl]
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:5173/nhat-ky/'
const PERIODS = ['sang', 'trua', 'chieu', 'toi', 'dem']
const TABS = ['today', 'backfill', 'habits', 'stats', 'settings']

function audit() {
  const parse = (c) => {
    let m = c.match(/rgba?\(([^)]+)\)/)
    if (m) {
      const p = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number)
      return [p[0], p[1], p[2], p[3] ?? 1]
    }
    m = c.match(/color\(srgb ([^)]+)\)/)
    if (m) {
      const p = m[1].split(/[ /]+/).filter(Boolean).map(Number)
      return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]
    }
    return null
  }
  const over = (top, bottom) => {
    const a = top[3]
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1)
  }
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const bgOf = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('url')) return null // gradient: skip
      const c = parse(cs.backgroundColor)
      if (c && c[3] > 0) {
        layers.push(c)
        if (c[3] >= 1) break
      }
    }
    let base = [255, 255, 255, 1]
    for (const l of layers.reverse()) base = over(l, base)
    return base
  }
  const out = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const t = walker.currentNode
    const el = t.parentElement
    if (!t.textContent.trim() || !el || seen.has(el)) continue
    seen.add(el)
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (!r.width || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
    if (el.closest('svg') || el.closest('[aria-hidden="true"]')) continue
    if (el.closest('button:disabled')) continue
    const fg = parse(cs.color)
    const bg = bgOf(el)
    if (!fg || !bg) continue
    const size = parseFloat(cs.fontSize)
    const bold = Number(cs.fontWeight) >= 700
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
    const cr = ratio(over(fg, bg), bg)
    if (cr < need)
      out.push(
        `${cr.toFixed(2)}<${need} ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${t.textContent.trim().slice(0, 30)}"`,
      )
  }
  return out
}

;(async () => {
  const browser = await chromium.launch()
  let total = 0
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: scheme,
      timezoneId: 'Asia/Ho_Chi_Minh',
    })
    const page = await ctx.newPage()
    await page.clock.install({ time: new Date('2026-10-30T21:40:00+07:00') })
    await page.goto(BASE, { waitUntil: 'load' })
    await page.clock.runFor(1500)
    await page.getByRole('button', { name: /Dùng ngay/ }).click()
    await page.waitForSelector('.tabbar')
    const added = await page.evaluate(() => window.nk.addPersonaMonth())
    if (!added) throw new Error('sample month not added')
    for (const period of PERIODS) {
      for (const tab of TABS) {
        await page.evaluate(
          ([p, t]) => {
            location.hash = '#/' + t
            document.documentElement.dataset.period = p
          },
          [period, tab],
        )
        await page.clock.runFor(800)
        await page.evaluate((p) => (document.documentElement.dataset.period = p), period)
        const bad = await page.evaluate(audit)
        total += bad.length
        if (bad.length)
          console.log(
            `${scheme} ${period} ${tab}: ${bad.length}\n  ` +
              [...new Set(bad)].slice(0, 8).join('\n  '),
          )
      }
    }
    await ctx.close()
  }
  console.log(total === 0 ? 'OK: no contrast failures' : `TOTAL ${total} failures`)
  await browser.close()
  process.exit(total === 0 ? 0 : 1)
})()
