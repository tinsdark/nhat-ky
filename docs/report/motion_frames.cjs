// Chụp từng khung hình của animation bằng cách đóng băng chúng ở các mốc thời gian (Web Animations API).
// Dùng: PW=... CHROME=... node docs/report/motion_frames.cjs docs/report/img/motion
const { chromium } = require(process.env.PW || 'playwright')
const fs = require('fs')
const OUT = process.argv[2] || 'docs/report/img/motion'
const BASE = process.env.BASE || 'http://127.0.0.1:5173/nhat-ky/'
fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' })
  await ctx.clock.install({ time: new Date('2026-10-30T21:40:00+07:00') })
  await ctx.clock.resume()
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('nk_skipLogin', '1'))
  await p.goto(BASE)
  await p.waitForTimeout(1500)
  await p.evaluate(() => window.nk.addPersonaMonth())
  await p.reload()
  await p.waitForTimeout(2500)

  // Làm chậm mọi animation (Chrome DevTools) rồi chụp theo thời gian thật: ảnh ở mốc t ms của animation
  // được chụp sau t / RATE ms thật.
  const RATE = 0.04
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Animation.enable')
  const shootSeries = async (times, name, trigger, prep) => {
    await cdp.send('Animation.setPlaybackRate', { playbackRate: RATE })
    const t0 = Date.now()
    await trigger()
    for (const t of times) {
      const wait = t / RATE - (Date.now() - t0)
      if (wait > 0) await p.waitForTimeout(wait)
      if (prep) await prep()
      await p.screenshot({ path: `${OUT}/${name}-${t}.jpg`, type: 'jpeg', quality: 85 })
    }
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 })
    await p.waitForTimeout(600)
  }

  // 1) Màn hình vào lần lượt từng thẻ: đổi tab để màn được dựng lại
  await shootSeries([0, 150, 300, 500], 'screen', async () => {
    await p.evaluate(() => (location.hash = '#/habits'))
  })
  await p.waitForTimeout(800)
  // 2) Biểu đồ vẽ dần
  await p.evaluate(() => (location.hash = '#/stats'))
  await p.waitForTimeout(1500)
  await shootSeries(
    [0, 250, 500, 1000],
    'chart',
    () => p.locator('.pills button', { hasText: 'Sức khoẻ' }).click(),
    () => p.evaluate(() => document.querySelector('.chart')?.scrollIntoView({ block: 'center' })),
  )
  await b.close()
  console.log('done')
})()
