// Smoke test of the main flows on the built app, in Chromium at phone size.
// Run: npm run build && npx vite preview --port 4173, then `node e2e/smoke.cjs [baseUrl]`.
// Uses the Playwright installed on the machine (not a project dependency).
const { chromium } = require('playwright')

const BASE = process.argv[2] ?? 'http://localhost:4173/nhat-ky/'
let failed = 0

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failed++
}

/** Live (not deleted) entries straight from IndexedDB. */
const entries = (page, type) =>
  page.evaluate(
    (t) =>
      new Promise((resolve) => {
        const req = indexedDB.open('nhat-ky')
        req.onsuccess = () => {
          const q = req.result.transaction('entries').objectStore('entries').getAll()
          q.onsuccess = () => resolve(q.result.filter((e) => !e.deleted && (!t || e.type === t)))
        }
      }),
    type,
  )

async function openApp(browser, { time, timezoneId = 'Asia/Ho_Chi_Minh' }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  if (time) await page.clock.install({ time: new Date(time) })
  await page.goto(BASE)
  await page.getByRole('button', { name: /Dùng ngay/ }).click()
  await page.waitForSelector('.tabbar')
  return { ctx, page, errors }
}

const bandText = (page) => page.locator('.band').first().innerText()

;(async () => {
  const browser = await chromium.launch()

  // B1: the day cut passes while the app stays open.
  {
    const { ctx, page } = await openApp(browser, { time: '2026-11-13T03:50:00+07:00' })
    await page.clock.runFor(1000)
    check(
      'before 04:00 the logical day is the previous one',
      (await bandText(page)).includes('12/11'),
    )
    await page.clock.fastForward('30:00')
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.clock.runFor(1500)
    const band = await bandText(page)
    check(
      'after 04:00 Hôm nay moves to the new day',
      band.includes('13/11') && band.includes('Hôm nay'),
    )
    check('quick buttons are still there', await page.getByText('Ghi nhanh').isVisible())
    await ctx.close()
  }

  // B2: double taps record once.
  {
    const { ctx, page } = await openApp(browser, { time: '2026-11-13T22:30:00+07:00' })
    await page.getByRole('button', { name: 'Đi ngủ' }).dblclick()
    await page.waitForTimeout(600)
    check('double tap on Đi ngủ opens one night', (await entries(page, 'sleep')).length === 1)
    await page.clock.fastForward('08:00:00')
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.clock.runFor(1500)
    await page
      .getByRole('button', { name: /Thức dậy/ })
      .first()
      .dblclick()
    await page.waitForTimeout(600)
    const sleeps = await entries(page, 'sleep')
    check(
      'double tap on Thức dậy closes it, adds nothing',
      sleeps.length === 1 && sleeps[0].end !== null,
    )
    await ctx.close()
  }

  // Two taps: a shortcut, then a category, starts a block; Kết thúc closes it.
  {
    const { ctx, page, errors } = await openApp(browser, { time: '2026-11-13T12:00:00+07:00' })
    await page
      .getByRole('button', { name: /Ăn uống/ })
      .first()
      .click()
    await page
      .locator('.sheet button')
      .filter({ hasText: /Ăn trưa/ })
      .first()
      .click()
    await page.waitForTimeout(600)
    const meals = await entries(page, 'meal')
    check('Ăn trưa in 2 taps', meals.length === 1 && meals[0].payload.running === true)
    await page.clock.fastForward('25:00')
    await page.getByRole('button', { name: 'Kết thúc' }).first().click()
    await page.waitForTimeout(600)
    const done = await entries(page, 'meal')
    check('Kết thúc stamps the end', done[0].end !== null && !done[0].payload.running)
    check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // Times on screen are Vietnam time even on a device set to another time zone.
  {
    const { ctx, page } = await openApp(browser, {
      time: '2026-11-13T09:05:00+07:00',
      timezoneId: 'Europe/London',
    })
    await page.clock.runFor(1000)
    check('clock shows Vietnam time on a London device', (await bandText(page)).includes('09:05'))
    await ctx.close()
  }

  await browser.close()
  console.log(failed === 0 ? '\nAll smoke checks passed.' : `\n${failed} check(s) failed.`)
  process.exit(failed === 0 ? 0 : 1)
})()
