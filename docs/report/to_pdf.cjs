// HTML -> PDF bằng Chromium. Dùng: PW=... CHROME=... node docs/report/to_pdf.cjs [html] [pdf]
const { chromium } = require(process.env.PW || 'playwright')
const path = require('path')
const html = path.resolve(process.argv[2] || 'docs/report/report.html')
const pdf = path.resolve(process.argv[3] || 'docs/report/Bao-cao-Nhat-ky.pdf')
;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined })
  const p = await b.newPage()
  await p.goto('file://' + html, { waitUntil: 'load' })
  await p.pdf({
    path: pdf,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="font-size:8px;width:100%;text-align:center;color:#6b5e45;font-family:sans-serif">Nhật ký · báo cáo dữ liệu mẫu, hành vi và giao diện · trang <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
    margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
  })
  await b.close()
  console.log('pdf', pdf)
})()
