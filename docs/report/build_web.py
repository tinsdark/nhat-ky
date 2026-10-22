#!/usr/bin/env python3
"""Bản web đọc thẳng được của báo cáo (một trang HTML, ảnh nhúng sẵn, sáng/tối theo máy).

Dùng cùng nội dung với build_report.py. Chạy: python3 docs/report/build_web.py [đường-dẫn-ra]
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_report as B  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(B.D, "report-web.html")

B.EMBED = True
# SVG colours follow the page theme.
B.INK, B.MUTED, B.ACC, B.OK, B.WARN, B.DANGER, B.GRID = (
    "var(--fg)", "var(--muted)", "var(--accent)", "var(--ok)", "var(--warn)", "var(--danger)", "var(--border)",
)

CSS = """
:root {
  --bg: #f7f0de; --card: #fffaf0; --surface: #f1e7cc; --border: #e3d5b4; --fg: #2b2418; --muted: #6b5e45;
  --accent: #2f5d50; --accent-soft: #dcebe3; --warn: #a8660a; --warn-soft: #fbe9c4; --danger: #b5473a; --danger-soft: #f7ded6;
  --ok: #2f7d46; --shade: #efe2bd; --code: #efe5c9;
  --sans: 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #1f1a14; --card: #2d251c; --surface: #3b3024; --border: #54452f; --fg: #f4eadb; --muted: #cdbda3;
    --accent: #8fd0b9; --accent-soft: #23372f; --warn: #f6bb4a; --warn-soft: #40331a; --danger: #ff8f80; --danger-soft: #43221b;
    --ok: #7fd9a0; --shade: #3a3020; --code: #3b3024; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #1f1a14; --card: #2d251c; --surface: #3b3024; --border: #54452f; --fg: #f4eadb; --muted: #cdbda3;
  --accent: #8fd0b9; --accent-soft: #23372f; --warn: #f6bb4a; --warn-soft: #40331a; --danger: #ff8f80; --danger-soft: #43221b;
  --ok: #7fd9a0; --shade: #3a3020; --code: #3b3024; color-scheme: dark;
}
body { background: var(--bg); color: var(--fg); font-family: var(--sans); font-size: 15px; line-height: 1.65;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); font-variant-numeric: tabular-nums; }
.wrap { max-width: 880px; margin: 0 auto; padding-block: 8px 64px; }
h1, h2, h3 { color: var(--accent); line-height: 1.25; text-wrap: balance; }
h1.part { font-size: 1.7rem; margin: 72px 0 20px; padding-bottom: 10px; border-bottom: 2px solid var(--accent); }
h2 { font-size: 1.3rem; margin: 40px 0 10px; }
h3 { font-size: 1.05rem; margin: 26px 0 8px; }
p, li { max-width: 72ch; }
li { margin-bottom: 6px; }
a { color: var(--accent); }
code, pre { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: .85em; background: var(--code); border-radius: 4px; }
code { padding: 1px 5px; } pre { padding: 12px 14px; overflow-x: auto; white-space: pre; line-height: 1.5; }
.small { font-size: .84rem; color: var(--muted); }
.cover { padding: 56px 0 24px; }
.cover .brand { font-size: .85rem; letter-spacing: .22em; text-transform: uppercase; color: var(--accent); margin-bottom: 18px; }
.cover h1 { font-size: clamp(1.9rem, 6vw, 2.8rem); line-height: 1.15; margin: 0 0 14px; color: var(--fg); }
.cover .sub { font-size: 1.05rem; color: var(--muted); max-width: 56ch; }
.cover .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px 24px; margin: 28px 0; }
.cover .note { border-left: 3px solid var(--warn); padding: 10px 14px; background: var(--warn-soft); font-size: .9rem; }
.toc { padding-left: 20px; } .toc li { margin-bottom: 10px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
.kpi { border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: var(--card); text-align: center; }
.kpi b { display: block; font-size: 1.9rem; color: var(--accent); line-height: 1.1; }
.kpi span { font-size: .8rem; color: var(--muted); }
.tw { overflow-x: auto; margin: 12px 0 18px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--border); padding: 6px 9px; vertical-align: top; text-align: left; font-size: .86rem; min-width: 0; }
th { background: var(--surface); }
table.dense th, table.dense td { font-size: .78rem; padding: 4px 7px; white-space: nowrap; }
table.hyp td { font-size: .82rem; }
.cal td { width: 14.28%; min-width: 92px; height: 96px; font-size: .74rem; }
.cal td b { font-size: 1rem; margin-right: 4px; }
.cal td.empty { background: transparent; } .cal td.we { background: var(--shade); }
.cal td.sick { background: var(--warn-soft); } .cal td.trip { background: color-mix(in srgb, #5b8fbf 22%, var(--card)); } .cal td.sprint { background: color-mix(in srgb, #ef7a2f 22%, var(--card)); }
.cal .hl { color: var(--muted); margin-top: 4px; font-size: .68rem; line-height: 1.3; }
.tg { font-size: .62rem; padding: 1px 6px; border-radius: 8px; background: var(--border); margin-right: 3px; color: var(--fg); }
.fig { margin: 22px 0; } .fig svg { width: 100%; height: auto; } .fig img.wide { width: 100%; border-radius: 10px; border: 1px solid var(--border); }
figcaption { font-size: .82rem; color: var(--muted); margin-top: 6px; max-width: 72ch; }
.callout { border-left: 3px solid var(--accent); padding: 10px 14px; margin: 16px 0; background: var(--accent-soft); }
.callout.warn { border-color: var(--warn); background: var(--warn-soft); } .callout b { display: block; margin-bottom: 4px; }
.bd { font-size: .72rem; padding: 1px 7px; border-radius: 8px; white-space: nowrap; }
.bd.ok { background: var(--accent-soft); color: var(--accent); } .bd.bad { background: var(--danger-soft); color: var(--danger); }
.shotrow { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 16px 0; align-items: start; }
.shotrow:has(.shot:nth-child(4)) { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.shot { position: relative; min-width: 0; }
.shot img { width: 100%; border: 1px solid var(--border); border-radius: 14px; display: block; }
.shot .cap { font-size: .8rem; color: var(--muted); margin-top: 6px; line-height: 1.45; }
.tagb, .taga { position: absolute; top: 8px; left: 8px; font-size: .7rem; font-weight: 700; padding: 2px 8px; border-radius: 8px; color: #fff; }
.tagb { background: #b5473a; } .taga { background: #2f7d46; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
"""


def toc():
    items = [
        ("top", "Tóm tắt điều hành", ""),
        ("scope", "Phạm vi, cách làm và giới hạn", ""),
        ("p1", "Phần 1. Dữ liệu mẫu tháng 10/2026", "kịch bản, quy mô, bảng 30 ngày, biểu đồ, bảng chỉ số"),
        ("p2", "Phần 2. Phân tích hành vi con người và các giả định", "18 giả định, sơ đồ tác động, hành vi dùng app, kiểm tra"),
        ("p3", "Phần 3. App tìm ra gì từ dữ liệu", "luật cảnh báo, tương quan 30 và 150 ngày, nhiễu lịch, đề xuất"),
        ("p4", "Phần 4. Ảnh chụp mọi màn hình, kèm số liệu", "Hôm nay, Ghi bù, Thói quen, Thống kê, Cài đặt, Quản lý"),
        ("p5", "Phần 5. Giao diện, trải nghiệm và chuyển động", "8 lỗi đã sửa, hệ chuyển động, chế độ tối, tham khảo Sổ Chi Tiêu"),
        ("p6", "Phần 6. Kết luận, rủi ro và việc tiếp theo", "kết luận, rủi ro, việc làm tiếp, phụ lục"),
    ]
    lis = "".join(f"<li><a href='#{i}'><b>{a}</b></a><br/><span class='small'>{b}</span></li>" for i, a, b in items)
    return f"<h2>Mục lục</h2><ol class='toc'>{lis}</ol>"


parts = [B.cover(), toc(), "<div id='top'></div>" + B.summary(), "<div id='scope'></div>" + B.scope(), B.part1(), B.part2(), B.part3(), B.part4(), B.part5(), B.part6()]
body = "\n".join(parts)
for n in range(1, 7):
    body = body.replace(f"<h1 class='part'>Phần {n}.", f"<h1 class='part' id='p{n}'>Phần {n}.", 1)
body = body.replace("để đọc được trên giấy", "để đọc được")
body = body.replace("<table", "<div class='tw'><table").replace("</table>", "</table></div>")
# SVG fills that were literal light-theme colours
for lit, tok in (("#f6efd9", "var(--surface)"), ("#fffaf0", "var(--card)"), ("#f3e3b8", "var(--shade)")):
    body = body.replace(lit, tok)

page = (
    "<title>Báo cáo Nhật ký</title>\n"
    '<meta name="claude:viewport-fit-sides" content="cover">\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap">\n'
    f"<style>{CSS}</style>\n<div class='wrap'>{body}</div>\n"
)
open(OUT, "w", encoding="utf-8").write(page)
print("wrote", OUT, len(page) // 1024, "KB")
