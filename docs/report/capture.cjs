// Chụp mọi màn hình của Nhật ký với dữ liệu mẫu tháng 10/2026 (chỉ chạy với `npm run dev`).
// Dùng: PW=/đường/dẫn/playwright node docs/report/capture.cjs <thư-mục-ra> [light|dark]
const { chromium } = require(process.env.PW || 'playwright')
const fs = require('fs')
const OUT = process.argv[2] || 'docs/report/img/after'
const SCHEME = process.argv[3] || 'light'
const BASE = process.env.BASE || 'http://127.0.0.1:5173/nhat-ky/'
const NOW = new Date('2026-10-30T21:40:00+07:00')
fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined })
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: SCHEME,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  })
  await ctx.clock.install({ time: NOW })
  await ctx.clock.resume()
  const p = await ctx.newPage()
  await p.addInitScript(() => localStorage.setItem('nk_skipLogin', '1'))
  const wait = (ms = 700) => p.waitForTimeout(ms)
  const go = async (hash) => {
    await p.goto(BASE + hash)
    await p.reload()
    await wait(1700) // chờ animation vào màn xong
  }
  const shotFull = async (name) => {
    const h = await p.evaluate(() => Math.min(5200, Math.max(844, document.documentElement.scrollHeight)))
    await p.setViewportSize({ width: 390, height: h })
    await wait(250)
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 86 })
    await p.setViewportSize({ width: 390, height: 844 })
    console.log('ok', name, h)
  }
  const shotView = async (name) => {
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 86 })
    console.log('ok', name)
  }
  const pill = async (label) => {
    await p.locator('.pills button', { hasText: label }).first().click()
    await wait(1500)
  }

  // dữ liệu
  await p.goto(BASE)
  await wait(1500)
  await p.evaluate(() => window.nk.addPersonaMonth())
  await p.reload()
  await wait(2500)

  await wait(1200)
  await shotFull('01-hom-nay')
  await shotView('02-hom-nay-man-dau')
  await p.locator('.quickgrid .quick', { hasText: 'Uống nước' }).click(); await wait(500)
  await shotView('03b-chon-luong-nuoc')
  await p.locator('.sheet-backdrop').click({ position: { x: 190, y: 60 } }); await wait(400)
  await p.locator('.quickgrid .quick', { hasText: 'Làm việc' }).click(); await wait(500)
  await shotView('03-chon-danh-muc')
  await p.locator('.sheet .quick', { hasText: 'Deep work' }).click(); await wait(500)
  await shotView('04-form-ghi-moi')
  await p.getByRole('button', { name: 'Bắt đầu' }).last().click(); await wait(800)
  await shotView('05-dang-lam')
  const row = p.locator('.timeline li, ul.tl li').first()
  await go('#/')
  await p.locator('main li, .screen li').filter({ hasText: 'Ăn tối' }).first().click().catch(() => {})
  await wait(500)
  await shotView('06-chi-tiet-muc')
  await go('#/')
  await p.getByRole('button', { name: 'Chấm' }).first().click().catch(() => {})
  await wait(500)
  await shotView('07-cham-ngay')
  await go('#/backfill'); await shotFull('08-ghi-bu')
  await go('#/habits'); await shotFull('09-thoi-quen')
  await go('#/stats')
  for (const [i, t] of ['Tổng quan', 'Ăn uống', 'Thời gian', 'Sức khoẻ', 'Báo cáo'].entries()) {
    await pill(t)
    await shotFull(`1${i}-thong-ke-${['tong-quan', 'an-uong', 'thoi-gian', 'suc-khoe', 'bao-cao'][i]}`)
  }
  await go('#/settings')
  for (const [i, t] of ['Danh mục', 'Mục tiêu', 'Cảnh báo', 'Hiển thị', 'Dữ liệu', 'Ứng dụng'].entries()) {
    await pill(t)
    await shotFull(`2${i}-cai-dat-${['danh-muc', 'muc-tieu', 'canh-bao', 'hien-thi', 'du-lieu', 'ung-dung'][i]}`)
  }
  await go('#/')
  await p.getByRole('button', { name: 'Sửa' }).first().click(); await wait(500)
  for (const [i, t] of ['Nút nhanh', 'Danh mục', 'Loại', 'Tag'].entries()) {
    await p.locator('.fullscreen .choice button', { hasText: t }).click(); await wait(400)
    await shotView(`3${i}-quan-ly-${['nut-nhanh', 'danh-muc', 'loai', 'tag'][i]}`)
  }
  await b.close()
})()
