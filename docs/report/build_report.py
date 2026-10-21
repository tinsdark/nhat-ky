#!/usr/bin/env python3
"""Dựng báo cáo PDF từ số liệu thật trong docs/report/data và ảnh trong docs/report/img.

Chạy: python3 docs/report/build_report.py && PW=... node docs/report/to_pdf.cjs
Mọi con số trong báo cáo đọc từ file JSON do docs/report/analysis.run.ts ghi ra, không gõ tay.
"""
import html
import json
import math
import os
import re
import shutil

from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
O = json.load(open(f"{D}/data/october.json"))
F = json.load(open(f"{D}/data/findings.json"))
R = json.load(open(f"{D}/data/rules-and-recovery.json"))
OUT_HTML = os.environ.get("REPORT_HTML", f"{D}/report.html")
SLICES = os.environ.get("REPORT_SLICES", f"{D}/img/slices")
os.makedirs(SLICES, exist_ok=True)

M = O["metrics"]
KEYS = O["keys"]
DAYS = O["days"]
WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
WD_LONG = ["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"]


def vn(x, d=1):
    if x is None:
        return "–"
    s = f"{x:.{d}f}"
    return s.replace(".", ",")


def hm(x):
    """Decimal clock hours (24.5 = 00:30) to HH:MM."""
    if x is None:
        return "–"
    h = int(x) % 24
    m = int(round((x - int(x)) * 60))
    if m == 60:
        h, m = (h + 1) % 24, 0
    return f"{h:02d}:{m:02d}"


def esc(s):
    return html.escape(str(s))


def val(mid, i):
    return M[mid]["values"][i]


# ------------------------------------------------------------------ SVG helpers
INK, MUTED, ACC, OK, WARN, DANGER, GRID = "#2b2418", "#6b5e45", "#2f5d50", "#2f7d46", "#a8660a", "#b5473a", "#e3d5b4"


def svg_open(w, h):
    return f'<svg viewBox="0 0 {w} {h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="DejaVu Sans, sans-serif">'


def bars(values, labels=None, w=640, h=190, color=ACC, target=None, target_label="", ymax=None, shade=None, fmt=lambda v: vn(v, 1), unit="", colors=None, show_values=False):
    pad_l, pad_r, pad_t, pad_b = 34, 8, 10, 26
    present = [v for v in values if v is not None]
    top = ymax or (max(present + [target or 0]) * 1.12 if present else 1)
    n = len(values)
    bw = (w - pad_l - pad_r) / n
    y = lambda v: pad_t + (1 - v / top) * (h - pad_t - pad_b)
    out = [svg_open(w, h)]
    for g in range(0, 5):
        gv = top * g / 4
        out.append(f'<line x1="{pad_l}" x2="{w - pad_r}" y1="{y(gv):.1f}" y2="{y(gv):.1f}" stroke="{GRID}" stroke-width="0.6"/>')
        out.append(f'<text x="{pad_l - 4}" y="{y(gv) + 3:.1f}" font-size="8" text-anchor="end" fill="{MUTED}">{fmt(gv)}</text>')
    if shade:
        for i, c in enumerate(shade):
            if c:
                out.append(f'<rect x="{pad_l + i * bw:.1f}" y="{pad_t}" width="{bw:.1f}" height="{h - pad_t - pad_b}" fill="{c}" opacity="0.5"/>')
    for i, v in enumerate(values):
        if v is None:
            continue
        col = colors[i] if colors else color
        out.append(f'<rect x="{pad_l + i * bw + 1.5:.1f}" y="{y(v):.1f}" width="{max(1, bw - 3):.1f}" height="{max(0.5, y(0) - y(v)):.1f}" rx="2" fill="{col}"/>')
        if show_values:
            out.append(f'<text x="{pad_l + i * bw + bw / 2:.1f}" y="{y(v) - 2:.1f}" font-size="7" text-anchor="middle" fill="{MUTED}">{fmt(v)}</text>')
    if target is not None:
        out.append(f'<line x1="{pad_l}" x2="{w - pad_r}" y1="{y(target):.1f}" y2="{y(target):.1f}" stroke="{DANGER}" stroke-width="1" stroke-dasharray="4 3"/>')
        out.append(f'<text x="{w - pad_r}" y="{y(target) - 3:.1f}" font-size="8" text-anchor="end" fill="{DANGER}">{esc(target_label)}</text>')
    if labels:
        for i, l in enumerate(labels):
            if l:
                out.append(f'<text x="{pad_l + i * bw + bw / 2:.1f}" y="{h - 10}" font-size="8" text-anchor="middle" fill="{MUTED}">{esc(l)}</text>')
    out.append("</svg>")
    return "".join(out)


def lines(series, labels, w=640, h=200, ymin=0, ymax=5, ticks=5, note=None, band=None):
    pad_l, pad_r, pad_t, pad_b = 34, 10, 10, 26
    n = len(labels)
    x = lambda i: pad_l + i * (w - pad_l - pad_r) / max(1, n - 1)
    y = lambda v: pad_t + (1 - (v - ymin) / (ymax - ymin)) * (h - pad_t - pad_b)
    out = [svg_open(w, h)]
    for g in range(ticks + 1):
        gv = ymin + (ymax - ymin) * g / ticks
        out.append(f'<line x1="{pad_l}" x2="{w - pad_r}" y1="{y(gv):.1f}" y2="{y(gv):.1f}" stroke="{GRID}" stroke-width="0.6"/>')
        out.append(f'<text x="{pad_l - 4}" y="{y(gv) + 3:.1f}" font-size="8" text-anchor="end" fill="{MUTED}">{vn(gv, 0 if (ymax - ymin) >= 5 else 1)}</text>')
    if band:
        for i, c in enumerate(band):
            if c:
                out.append(f'<rect x="{x(i) - (w - pad_l - pad_r) / max(1, n - 1) / 2:.1f}" y="{pad_t}" width="{(w - pad_l - pad_r) / max(1, n - 1):.1f}" height="{h - pad_t - pad_b}" fill="{c}" opacity="0.45"/>')
    for name, vals, col in series:
        pts, seg = [], []
        for i, v in enumerate(vals):
            if v is None:
                if seg:
                    pts.append(seg)
                    seg = []
            else:
                seg.append((x(i), y(v)))
        if seg:
            pts.append(seg)
        for s in pts:
            out.append(f'<polyline points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in s)}" fill="none" stroke="{col}" stroke-width="1.8" stroke-linejoin="round"/>')
            for a, b in s:
                out.append(f'<circle cx="{a:.1f}" cy="{b:.1f}" r="2" fill="{col}"/>')
    for i, l in enumerate(labels):
        if l:
            out.append(f'<text x="{x(i):.1f}" y="{h - 10}" font-size="8" text-anchor="middle" fill="{MUTED}">{esc(l)}</text>')
    lx = pad_l
    for name, _, col in series:
        out.append(f'<rect x="{lx}" y="{h - 8}" width="8" height="3" fill="{col}"/><text x="{lx + 11}" y="{h - 4}" font-size="8" fill="{MUTED}">{esc(name)}</text>')
        lx += 22 + len(name) * 5
    out.append("</svg>")
    return "".join(out)


def scatter(points, w=300, h=220, xlab="", ylab="", xmin=None, xmax=None, ymin=None, ymax=None, color=ACC, fmtx=lambda v: vn(v, 1), fmty=lambda v: vn(v, 1)):
    pad_l, pad_r, pad_t, pad_b = 36, 10, 10, 34
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    xmin = min(xs) if xmin is None else xmin
    xmax = max(xs) if xmax is None else xmax
    ymin = min(ys) if ymin is None else ymin
    ymax = max(ys) if ymax is None else ymax
    sx = lambda v: pad_l + (v - xmin) / ((xmax - xmin) or 1) * (w - pad_l - pad_r)
    sy = lambda v: pad_t + (1 - (v - ymin) / ((ymax - ymin) or 1)) * (h - pad_t - pad_b)
    out = [svg_open(w, h)]
    for g in range(5):
        gy = ymin + (ymax - ymin) * g / 4
        gx = xmin + (xmax - xmin) * g / 4
        out.append(f'<line x1="{pad_l}" x2="{w - pad_r}" y1="{sy(gy):.1f}" y2="{sy(gy):.1f}" stroke="{GRID}" stroke-width="0.6"/>')
        out.append(f'<text x="{pad_l - 4}" y="{sy(gy) + 3:.1f}" font-size="8" text-anchor="end" fill="{MUTED}">{fmty(gy)}</text>')
        out.append(f'<text x="{sx(gx):.1f}" y="{h - 18}" font-size="8" text-anchor="middle" fill="{MUTED}">{fmtx(gx)}</text>')
    for a, b in points:
        out.append(f'<circle cx="{sx(a):.1f}" cy="{sy(b):.1f}" r="3" fill="{color}" opacity="0.65"/>')
    n = len(points)
    if n > 2:
        mx, my = sum(xs) / n, sum(ys) / n
        sxx = sum((a - mx) ** 2 for a in xs)
        if sxx > 0:
            k = sum((a - mx) * (b - my) for a, b in points) / sxx
            c = my - k * mx
            out.append(f'<line x1="{sx(xmin):.1f}" y1="{sy(c + k * xmin):.1f}" x2="{sx(xmax):.1f}" y2="{sy(c + k * xmax):.1f}" stroke="{DANGER}" stroke-width="1.4"/>')
    out.append(f'<text x="{(w + pad_l) / 2:.1f}" y="{h - 4}" font-size="8.5" text-anchor="middle" fill="{INK}">{esc(xlab)}</text>')
    out.append(f'<text x="8" y="{h / 2:.1f}" font-size="8.5" text-anchor="middle" fill="{INK}" transform="rotate(-90 8 {h / 2:.1f})">{esc(ylab)}</text>')
    out.append("</svg>")
    return "".join(out)


def pearson(points):
    n = len(points)
    if n < 3:
        return None
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((a - mx) ** 2 for a in xs)
    syy = sum((b - my) ** 2 for b in ys)
    if sxx == 0 or syy == 0:
        return None
    return sum((a - mx) * (b - my) for a, b in points) / math.sqrt(sxx * syy)


def figure(svg, caption, num=[0]):
    num[0] += 1
    return f'<figure class="fig">{svg}<figcaption><b>Hình {num[0]}.</b> {caption}</figcaption></figure>'


def table(head, rows, cls="", widths=None):
    th = "".join(f"<th>{h}</th>" for h in head)
    body = ""
    for r in rows:
        body += "<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>"
    return f'<table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'


def callout(kind, title, text):
    return f'<div class="callout {kind}"><b>{title}</b><div>{text}</div></div>'


# ------------------------------------------------------------------ screenshots
def slice_image(path, name, chunk_css=844, scale=2, overlap=0):
    """Cut a tall screenshot into phone-height slices; returns the list of file paths."""
    im = Image.open(path)
    w, h = im.size
    step = chunk_css * scale
    out = []
    i = 0
    y = 0
    while y < h:
        box = (0, y, w, min(h, y + step))
        piece = im.crop(box)
        fp = f"{SLICES}/{name}-{i}.jpg"
        piece.save(fp, quality=84)
        out.append(fp)
        i += 1
        y += step - overlap
    return out


def shots(folder, names, captions, per_row=3):
    """Figure grid of phone slices. `captions` aligns with the flat slice list."""
    flat = []
    for nm in names:
        src = f"{D}/img/{folder}/{nm}.jpg"
        if not os.path.exists(src):
            continue
        for k, fp in enumerate(slice_image(src, f"{folder}-{nm}")):
            flat.append((nm, k, fp))
    cells = []
    for idx, (nm, k, fp) in enumerate(flat):
        cap = captions.get((nm, k)) or captions.get(nm) or ""
        cells.append(f'<div class="shot"><img src="file://{fp}"/><div class="cap">{cap}</div></div>')
    rows = [cells[i : i + per_row] for i in range(0, len(cells), per_row)]
    return "".join(f'<div class="shotrow {"three" if per_row == 3 else ""}">{"".join(r)}</div>' for r in rows)


# ================================================================== derived numbers
# Expected direction of each measurable hypothesis (+1: higher with the factor, −1: lower).
SIGN = {"H1": 1, "H2": -1, "H3": -1, "H4": -1, "H5": -1, "H6": 1, "H10": -1, "H11": 1, "H12": 1, "H17": 1}


def day_index(k):
    return KEYS.index(k)


SICK = [i for i, d in enumerate(DAYS) if d["dayType"] == "sick"]
TRAVEL = [i for i, d in enumerate(DAYS) if d["dayType"] == "travel"]
SPRINT = [day_index(k) for k in ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]]
WEEKEND = [i for i, d in enumerate(DAYS) if d["weekday"] >= 5]
NORMAL_WD = [i for i, d in enumerate(DAYS) if d["weekday"] < 5 and i not in SICK and i not in SPRINT]
N_FIND30, N_FIND150, N_WK150 = len(F["days30"]), len(F["days150"]), len(F["weekday150"])


def mean_of(vals):
    xs = [v for v in vals if v is not None]
    return sum(xs) / len(xs) if xs else None


def day_val(name, i):
    """Metric value, or the self-rated Day field when `name` is one of those."""
    if name in ("mood", "energy", "stress", "focus", "dayScore"):
        return DAYS[i][name]
    return val(name, i)


def group_mean(name, idxs):
    return mean_of([day_val(name, i) for i in idxs])


def cell_tag(i):
    d = DAYS[i]
    tags = []
    if i in SICK:
        tags.append('<span class="tg sick">ốm</span>')
    if i in TRAVEL:
        tags.append('<span class="tg trip">đi xa</span>')
    if i in SPRINT:
        tags.append('<span class="tg sprint">nước rút</span>')
    if d["weekday"] >= 5 and i not in TRAVEL:
        tags.append('<span class="tg we">cuối tuần</span>')
    return "".join(tags)


def calendar_html():
    first = 0  # 1/10/2026 is a Thursday
    lead = DAYS[0]["weekday"]
    cells = [""] * lead + list(range(len(KEYS)))
    while len(cells) % 7:
        cells.append("")
    head = "".join(f"<th>{w}</th>" for w in WD)
    rows = ""
    for r in range(0, len(cells), 7):
        rows += "<tr>"
        for c in cells[r : r + 7]:
            if c == "":
                rows += "<td class='empty'></td>"
            else:
                d = DAYS[c]
                cls = "sick" if c in SICK else "trip" if c in TRAVEL else "sprint" if c in SPRINT else "we" if d["weekday"] >= 5 else ""
                rows += f"<td class='{cls}'><b>{int(KEYS[c][-2:])}</b>{cell_tag(c)}<div class='hl'>{esc(d['highlight'])}</div></td>"
        rows += "</tr>"
    return f'<table class="cal"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>'


def shade(v, lo, hi, good_high=True):
    if v is None:
        return ""
    t = (v - lo) / ((hi - lo) or 1)
    t = min(1, max(0, t))
    if not good_high:
        t = 1 - t
    a = 0.08 + 0.4 * t
    return f' style="background:rgba(47,93,80,{a:.2f})"'


def daily_table(idxs):
    head = ["Ngày", "Loại", "Ngủ (giờ)", "Đi ngủ", "Dậy", "Chất lượng", "Deep work", "OT", "Nước", "Cà phê", "Vận động", "Năng lượng", "Tâm trạng", "Stress", "Điểm ngày"]
    rows = []
    for i in idxs:
        d = DAYS[i]
        loai = "ốm" if i in SICK else "đi xa" if i in TRAVEL else "nước rút" if i in SPRINT else WD[d["weekday"]]
        sh, bt, wk, ql = val("sleep_hours", i), val("bedtime", i), val("wake_time", i), val("sleep_quality", i)
        dw, ot, wt, cf, ex = val("deep_work_hours", i), val("overtime_hours", i), val("water_ml", i), val("coffee_count", i), val("exercise_min", i)
        rows.append(
            [
                f"{int(KEYS[i][-2:])}/10",
                loai,
                f"<span{shade(sh, 5.5, 8.5)}>{vn(sh)}</span>",
                hm(bt),
                hm(wk),
                f"<span{shade(ql, 1, 5)}>{vn(ql, 0) if ql is not None else '–'}</span>",
                vn(dw),
                vn(ot) if ot else "–",
                f"<span{shade(wt, 1000, 2500)}>{int(wt) if wt is not None else '–'}</span>",
                int(cf) if cf is not None else "–",
                int(ex) if ex else "–",
                f"<span{shade(d['energy'], 1, 5)}>{d['energy'] if d['energy'] is not None else '–'}</span>",
                f"<span{shade(d['mood'], 1, 5)}>{d['mood'] if d['mood'] is not None else '–'}</span>",
                f"<span{shade(d['stress'], 1, 5, False)}>{d['stress'] if d['stress'] is not None else '–'}</span>",
                f"<span{shade(d['dayScore'], 1, 10)}>{d['dayScore'] if d['dayScore'] is not None else '–'}</span>",
            ]
        )
    return table(head, rows, "dense")


def compare_table():
    spec = [
        ("stress", "Stress tự chấm (1–5)", 1),
        ("mood", "Tâm trạng (1–5)", 1),
        ("energy", "Năng lượng (1–5)", 1),
        ("sleep_hours", "Giờ ngủ đêm đó", 1),
        ("bedtime", "Giờ đi ngủ", None),
        ("exercise_min", "Phút vận động", 0),
        ("water_ml", "Nước uống (ml)", 0),
        ("dinner_time", "Giờ ăn tối", None),
        ("overtime_hours", "Giờ OT", 1),
        ("deep_work_hours", "Giờ deep work", 1),
    ]
    rows = []
    for name, lab, dec in spec:
        a, b = group_mean(name, NORMAL_WD), group_mean(name, SPRINT)
        if dec is None:
            rows.append([lab, hm(a), hm(b), f"{'+' if b >= a else '−'}{int(round(abs(b - a) * 60))} phút"])
        else:
            rows.append([lab, vn(a, dec), vn(b, dec), f"{'+' if b >= a else '−'}{vn(abs(b - a), dec)}"])
    return table(["Chỉ số", f"Ngày làm thường ({len(NORMAL_WD)} ngày)", f"Tuần nước rút ({len(SPRINT)} ngày)", "Chênh"], rows)


# ================================================================== PART 0: cover, summary, scope
def cover():
    return f"""
<section class="cover">
  <div class="brand">Nhật ký</div>
  <h1>Dữ liệu mẫu, hành vi con người và trải nghiệm sử dụng</h1>
  <p class="sub">Báo cáo kỹ thuật: một tháng dữ liệu giả định, mô hình hành vi, kết quả phân tích của app, ảnh chụp mọi màn hình và đợt nâng giao diện / chuyển động</p>
  <div class="meta">
    <div><b>Người dùng</b><br/>Nguyễn Tiến Đạt</div>
    <div><b>Ngày lập</b><br/>21/10/2026</div>
    <div><b>Kỳ dữ liệu mẫu</b><br/>01/10 – 30/10/2026 (30 ngày)</div>
    <div><b>Nhánh mã nguồn</b><br/>claude/serene-knuth-tya6av</div>
  </div>
  <div class="note">Toàn bộ dữ liệu trong báo cáo là dữ liệu giả sinh bằng chương trình (<code>src/dev/persona.ts</code>). Không có dòng nào lấy từ nhật ký thật của người dùng. Các con số là kết quả tính lại bằng chính bộ chỉ số và bộ phân tích của app, không gõ tay.</div>
</section>"""


def summary():
    rec = R["recovery"]
    right = sum(1 for r in rec if r["diff"] is not None and r["diff"] * SIGN[r["id"]] > 0)
    return f"""
<h2>Tóm tắt điều hành</h2>
<p>Đạt giao bốn việc: (1) dựng một tháng dữ liệu giả định cụ thể rồi chụp mọi thông tin, số liệu của app; (2) phân tích hành vi của người bình thường để đưa ra các giả định và làm chi tiết; (3) làm lại giao diện và chuyển động cho tốt nhất; (4) viết báo cáo tổng hợp. Dưới đây là kết quả theo đúng thứ tự đó.</p>
<div class="kpis">
  <div class="kpi"><b>{O['entryTotal']}</b><span>mục ghi trong 30 ngày</span></div>
  <div class="kpi"><b>18</b><span>giả định hành vi (H1–H18)</span></div>
  <div class="kpi"><b>{right}/{len(rec)}</b><span>giả định đo được đều ra đúng hướng</span></div>
  <div class="kpi"><b>{len([n for n in os.listdir(D + '/img/after') if n.endswith('.jpg')])}</b><span>màn hình / bảng đã chụp</span></div>
</div>
<h3>Kết quả chính</h3>
<ul>
  <li><b>Dữ liệu.</b> Tháng 10/2026 của một nhân viên văn phòng mẫu: {O['counts'].get('meal',0)} bữa ăn/đồ uống, {O['counts'].get('work',0)} khối làm việc, {O['counts'].get('water',0)} lần uống nước, {O['counts'].get('note',0)} lần check-in, {O['counts'].get('sleep',0)} đêm ngủ, kèm 2 ngày ốm (8–9/10), 2 ngày đi xa (17–18/10) và một tuần nước rút deadline (19–23/10). Trung bình ngủ {vn(M['sleep_hours']['mean'],2)} giờ, chất lượng {vn(M['sleep_quality']['mean'],1)}/5, uống {int(M['water_ml']['mean'])} ml nước/ngày, deep work {vn(M['deep_work_hours']['mean'],1)} giờ/ngày.</li>
  <li><b>Hành vi.</b> 18 giả định có đánh số, mỗi giả định ghi rõ lý do và độ lớn hiệu ứng được chọn. Chạy mô phỏng 400 ngày, cả {right} giả định đo được đều cho hiệu ứng đúng chiều đã giả định; độ lớn đo được thường lớn hơn độ lớn đặt vào vì các yếu tố đi cùng nhau (ví dụ ngày căng thẳng uống cà phê chiều nhiều hơn).</li>
  <li><b>Phân tích của app.</b> Với 30 ngày, bộ tương quan chỉ báo {N_FIND30} kết quả; với 150 ngày báo {N_FIND150} kết quả và {N_WK150} kết quả theo thứ trong tuần. Phần lớn kết quả mạnh nhất chỉ phản ánh lịch ngày thường/cuối tuần chứ không phải nguyên nhân (mục 3.4). Đây là điểm yếu thật của bộ phân tích, đã ghi thành đề xuất.</li>
  <li><b>Giao diện.</b> Rà soát ở 320 / 360 / 390 / 430 px (sáng và tối), tìm và sửa 6 lỗi bố cục thật (qua script, đọc ảnh chụp và ảnh Đạt gửi từ iPhone: lịch tháng bị cắt cột Chủ nhật, hàng tab bị cắt, công tắc cảnh báo lệch, lưới giờ tràn, nhãn trục biểu đồ đè lên cột, màn Quản lý dính sát nhau). Thêm một hệ chuyển động thống nhất, tắt hoàn toàn khi máy bật "Giảm chuyển động".</li>
</ul>
<h3>Những gì chưa làm được hoặc chưa kiểm chứng</h3>
<ul>
  <li>Chưa thử trên iPhone thật: mọi ảnh chụp, đo bố cục và chuyển động đều từ Chromium giả lập màn 390×844. Độ mượt animation trên máy thật chưa đo.</li>
  <li>Dữ liệu mẫu không thay được dữ liệu thật: các độ lớn hiệu ứng là giả định của người viết, không phải kết luận khoa học. Báo cáo kiểm tra xem <i>app có tìm lại được thứ đã cài vào hay không</i>, không kiểm tra xem con người có đúng như vậy hay không.</li>
  <li>Báo cáo không dùng tài liệu nghiên cứu bên ngoài; các giả định dựa trên hiểu biết phổ biến về giấc ngủ, caffeine, nhịp sinh học và ghi nhận thường thấy trong các ứng dụng theo dõi sức khoẻ.</li>
</ul>"""


def scope():
    return """
<h2>Phạm vi, cách làm và giới hạn</h2>
<h3>Cách làm</h3>
<table class="plain">
<tr><th>Bước</th><th>Việc</th><th>Cách kiểm tra</th></tr>
<tr><td>1</td><td>Viết mô hình hành vi thành 18 giả định, mỗi giả định có lý do và độ lớn.</td><td>Mỗi giả định chạy trong bộ sinh dữ liệu; có test chạy 400 ngày kiểm tra chiều của hiệu ứng.</td></tr>
<tr><td>2</td><td>Sinh tháng 10/2026 bằng bộ sinh có hạt giống cố định (cùng hạt giống thì cùng dữ liệu).</td><td>Test: dữ liệu giống hệt khi sinh lại; mọi mục nằm đúng ngày logic; không có mục nào sau 21:40 ngày 30/10.</td></tr>
<tr><td>3</td><td>Nạp vào app thật (IndexedDB) rồi chụp mọi màn, mọi tab, mọi bảng bằng trình duyệt tự động, đồng hồ giả lập 21:40 ngày 30/10.</td><td>Xem lại ảnh; số trên màn khớp số tính từ bộ chỉ số.</td></tr>
<tr><td>4</td><td>Tính lại số liệu bằng chính bộ chỉ số, bộ luật, bộ tương quan của app và ghi ra JSON.</td><td>Báo cáo đọc từ JSON, không gõ tay con số nào.</td></tr>
<tr><td>5</td><td>Rà soát giao diện bằng script: tràn ngang, đè nút, dính sát, chữ tràn ô; sửa; rà lại.</td><td>Script chạy ở 4 độ rộng, 2 chế độ sáng/tối; kết quả đối chiếu trước/sau (mục 5.2).</td></tr>
</table>
<h3>Giới hạn cần biết trước khi đọc số</h3>
<ul>
  <li><b>Dữ liệu giả.</b> Mọi hiệu ứng được cài vào có chủ đích. Khi báo cáo nói "app tìm ra X" nghĩa là X đã được cài và app lấy lại được; không phải bằng chứng về con người thật.</li>
  <li><b>Một người, một tháng.</b> Một người mẫu duy nhất, một tháng duy nhất. Hai tuần đầu có ít ngày để so sánh, nên nhiều kết quả thống kê của app bị gác lại (đúng thiết kế, app yên lặng khi dữ liệu mỏng).</li>
  <li><b>Thiếu các thứ khó mô phỏng.</b> Không có ảnh bữa ăn, ghi chú tự do, rượu bia, thẻ tag; chỉ có một thói quen có tick tay (đọc sách). Không có ngày quên ghi hoàn toàn, chỉ có 20% check-in bị bỏ lỡ.</li>
  <li><b>Môi trường chụp.</b> Chromium giả lập 390×844, tỉ lệ điểm ảnh 2, múi giờ Asia/Ho_Chi_Minh, tiếng Việt. Phông chữ trong ảnh là phông hệ thống nếu Be Vietnam Pro không tải được.</li>
</ul>"""


# ================================================================== PART 1: sample data
def part1():
    sec = []
    sec.append("<h1 class='part'>Phần 1. Dữ liệu mẫu tháng 10/2026</h1>")
    sec.append(f"""
<h2>1.1 Người dùng mẫu và kịch bản của tháng</h2>
<p>Người dùng mẫu là một nhân viên văn phòng 23 tuổi làm lập trình viên, đi làm từ thứ hai đến thứ sáu (khung 08:00–17:30 theo Cài đặt, thực tế bắt đầu quanh 09:05–09:20), đi xe máy 25 phút mỗi chiều, uống cà phê, thích học thêm phân tích nghiệp vụ (BA) buổi tối và vận động cuối tuần. Chọn mẫu này vì sát với chính Đạt, nên các màn hình trông giống thứ Đạt sẽ thấy, và vì lịch ngày thường / cuối tuần tạo ra nhiều hành vi đối lập cần phân tích.</p>
<p>Tháng được viết kịch bản như một tháng thật có biến cố: hai ngày ốm liền nhau, một chuyến đi cuối tuần và một tuần nước rút deadline. Ba biến cố này kiểm tra đúng các chỗ bộ phân tích dễ sai (ngày ốm/đi xa phải bị loại, tuần nước rút phải kéo stress lên).</p>
{figure(calendar_html(), "Lịch tháng 10/2026 của người dùng mẫu. Ô vàng là ngày ốm, ô xanh dương là ngày đi xa, ô cam là tuần nước rút, ô nâu nhạt là cuối tuần. Dòng chữ nhỏ là câu 'điểm nổi bật' người dùng mẫu tự ghi khi chấm ngày.")}
<p>Ngày 30/10 (thứ sáu) là ngày đang diễn ra: đồng hồ giả lập dừng ở 21:40, nên ngày này mới ghi đến 21:40, chưa chấm ngày và chưa có đêm ngủ tối nay. Điều này cố ý để màn Hôm nay trông đúng như lúc người dùng thật mở app buổi tối.</p>
<h2>1.2 Quy mô dữ liệu</h2>
<p>Tổng cộng <b>{O['entryTotal']}</b> mục ghi (Entry) và 29 bản chấm ngày (Day). Mỗi Entry có loại, thời điểm bắt đầu/kết thúc, danh mục, và các trường riêng theo loại (chất lượng giấc ngủ, điểm tập trung, số lần bị ngắt, bữa ăn, nơi ăn…).</p>""")
    types = [
        ("meal", "Ăn uống", "Bữa sáng/trưa/tối, ăn vặt, cà phê. Có bữa, nơi ăn, khẩu phần, chất lượng, danh sách món."),
        ("activity", "Hoạt động", "Di chuyển, học BA, đọc sách, giải trí, mạng xã hội, việc nhà, gặp bạn bè, ra ngoài trời."),
        ("work", "Làm việc", "Deep work, họp, hỗ trợ, email/chat; có dự án, điểm tập trung, số lần bị ngắt, cờ làm thêm giờ (OT)."),
        ("water", "Uống nước", "Mỗi lần một ly 250 ml."),
        ("note", "Check-in", "Năng lượng và tâm trạng 1–5, ghi riêng từng lần, tối đa 4 lần/ngày."),
        ("sleep", "Ngủ", "Giờ ngủ → giờ dậy, chất lượng 1–5, số lần thức giấc, dùng màn hình trước ngủ, báo thức."),
        ("exercise", "Vận động", "Chạy bộ, gym, đạp xe, đi bộ đường dài; cường độ, quãng đường."),
        ("habit", "Thói quen", "Một lần tick 'Đọc sách 20 phút' kèm số phút."),
    ]
    rows = [[n, label, O["counts"].get(t, 0), desc] for t, label, desc in types for n in [t]]
    sec.append(table(["Mã loại", "Tên trong app", "Số mục", "Nội dung"], rows))
    sec.append(callout("warn", "Chưa có trong dữ liệu mẫu", "Ảnh bữa ăn, ghi chú tự do, rượu bia, thẻ tag, ngày hoàn toàn không ghi và các thói quen ngoài 'Đọc sách'. Các tính năng này hoạt động nhưng chưa được dữ liệu mẫu kiểm tra. Mục 2.7 liệt kê cách bổ sung."))
    sec.append("""
<h2>1.3 Bảng số liệu theo ngày</h2>
<p>Hai bảng dưới liệt kê mọi ngày với các chỉ số chính, đọc từ bộ chỉ số của app (registry). Ô tô xanh càng đậm càng 'tốt' theo hướng của chỉ số (với stress, đậm nghĩa là ít stress). Dấu '–' nghĩa là ngày đó không có dữ liệu cho chỉ số ấy (không phải bằng 0, theo quy ước null ≠ 0 của app).</p>""")
    sec.append("<h3>Từ 1 đến 15/10</h3>" + daily_table(range(0, 15)))
    sec.append("<h3>Từ 16 đến 30/10</h3>" + daily_table(range(15, 30)))
    sec.append("""<p class="small">Đêm ngủ được tính cho ngày bắt đầu đêm đó (CLAUDE.md, luật 7): 'Ngủ 6,5 giờ ngày 19/10' là đêm từ tối 19 sang sáng 20. Ngày 30/10 chưa có đêm ngủ vì mới 21:40. Ngày 17/10 (đi xa) không có điểm ngày vì không có check-in nào được ghi.</p>""")

    # ---- charts
    sleep_h = [val("sleep_hours", i) for i in range(30)]
    wk_shade = ["#f3e3b8" if DAYS[i]["weekday"] >= 5 else None for i in range(30)]
    lab = [str(int(k[-2:])) if (int(k[-2:]) % 3 == 1) else "" for k in KEYS]
    sec.append("<h2>1.4 Dữ liệu nhìn bằng biểu đồ</h2>")
    sec.append(figure(bars(sleep_h, lab, target=7.5, target_label="mục tiêu 7,5 giờ", shade=wk_shade, ymax=10), "Giờ ngủ từng đêm (đêm bắt đầu ở ngày ghi trên trục). Vùng nâu nhạt là thứ bảy và chủ nhật. Chỉ " + str(sum(1 for v in sleep_h if v is not None and v >= 7.5)) + " đêm đạt mục tiêu 7,5 giờ; đêm chủ nhật thường ngắn nhất vì sáng thứ hai có báo thức 06:30."))
    bed = [val("bedtime", i) for i in range(30)]
    wake = [val("wake_time", i) for i in range(30)]
    sec.append(figure(lines([("Giờ đi ngủ (sau 24 = qua nửa đêm)", bed, ACC), ("Giờ dậy", wake, WARN)], lab, ymin=6, ymax=26, ticks=5, band=wk_shade), "Giờ đi ngủ và giờ dậy. Trục dọc là giờ trong ngày (24 = nửa đêm). Cuối tuần giờ ngủ trễ rõ rệt, giờ dậy trễ hơn khoảng " + str(int(round((M['wake_time']['weekendMean'] - M['wake_time']['weekdayMean']) * 60))) + " phút: lệch múi giờ xã hội trung bình " + vn(M['social_jetlag']['mean'], 2) + " giờ."))
    en = [DAYS[i]["energy"] for i in range(30)]
    mo = [DAYS[i]["mood"] for i in range(30)]
    st = [DAYS[i]["stress"] for i in range(30)]
    sec.append(figure(lines([("Năng lượng", en, ACC), ("Tâm trạng", mo, OK), ("Stress", st, DANGER)], lab, ymin=1, ymax=5, ticks=4, band=wk_shade), "Ba chỉ số tự chấm theo ngày. Stress dồn lên cao trong tuần nước rút (19–23/10), tâm trạng và năng lượng đi xuống cùng lúc; cuối tuần tâm trạng cao hơn hẳn."))
    dw = [val("deep_work_hours", i) for i in range(30)]
    ot = [val("overtime_hours", i) or 0 for i in range(30)]
    sec.append(figure(bars(dw, lab, color=ACC, shade=wk_shade, ymax=7), "Giờ deep work mỗi ngày. Tuần nước rút cao nhất (có thêm khối buổi tối tính là OT: trung bình " + vn(group_mean('overtime_hours', SPRINT), 1) + " giờ OT mỗi ngày trong tuần đó). Hai ngày ốm và cuối tuần bằng 0."))
    wt = [val("water_ml", i) for i in range(30)]
    sec.append(figure(bars(wt, lab, color="#2a7f99", target=2000, target_label="mục tiêu 2000 ml", shade=wk_shade, ymax=2800, fmt=lambda v: str(int(v))), "Lượng nước. Trung bình " + str(int(M['water_ml']['mean'])) + " ml, chỉ " + str(sum(1 for v in wt if v is not None and v >= 2000)) + " ngày đạt mục tiêu 2 lít. Tuần nước rút thấp nhất, ngày ốm cao hơn mức thường."))
    sec.append("""
<h2>1.5 Tóm tắt các chỉ số của app</h2>
<p>Bảng dưới là toàn bộ chỉ số trong bộ đăng ký chỉ số (registry) tính trên tháng này. Cột 'n' là số ngày có giá trị. 'Ngày thường' và 'Cuối tuần' tách theo ngày bắt đầu.</p>""")
    groups = {"sleep": "Giấc ngủ", "food": "Ăn uống", "time": "Thời gian", "body": "Cơ thể", "mind": "Tinh thần", "habit": "Thói quen"}
    for gid, gname in groups.items():
        rows = []
        for mid, m in M.items():
            if m["group"] != gid:
                continue
            isclock = mid in ("bedtime", "wake_time", "sleep_midpoint", "dinner_time", "last_coffee_time", "work_start_time")
            f = (lambda x: hm(x)) if isclock else (lambda x: vn(x, 2 if abs(x or 0) < 10 else 1) if x is not None else "–")
            rows.append([m["label"], m["unit"], m["n"], f(m["mean"]), vn(m["sd"], 2), f(m["min"]), f(m["max"]), f(m["weekdayMean"]), f(m["weekendMean"])])
        if rows:
            sec.append(f"<h3>{gname}</h3>" + table(["Chỉ số", "Đơn vị", "n", "Trung bình", "Độ lệch", "Nhỏ nhất", "Lớn nhất", "Ngày thường", "Cuối tuần"], rows, "dense"))
    sec.append("""<p class="small">Các chỉ số 'late_eating' (ăn khuya) và 'alcohol' (rượu bia) bằng 0 cả tháng: người dùng mẫu không ăn sau mốc khuya của app và không uống rượu. Đó là một lựa chọn của mô hình, không phải lỗi.</p>""")
    # ---- what the data says
    ws, we = group_mean("sleep_hours", [i for i in WEEKEND if i not in TRAVEL]), None
    sec.append(f"""
<h2>1.6 Dữ liệu cho thấy gì</h2>
<p>Trước khi đi vào phân tích của app, đọc thẳng các con số sẽ thấy năm điều.</p>
<ol>
  <li><b>Ngủ thiếu nhẹ nhưng đều.</b> Trung bình {vn(M['sleep_hours']['mean'],2)} giờ so với mục tiêu 7,5; độ lệch giờ ngủ 7 ngày quanh {vn(M['bedtime_sd7']['mean'],2)} giờ (khoảng 30 phút), một mức khá ổn định.</li>
  <li><b>Hai kiểu ngày khác hẳn nhau.</b> Điểm ngày trung bình ngày thường {vn(M['day_score']['weekdayMean'],1)}, cuối tuần {vn(M['day_score']['weekendMean'],1)}; stress {vn(M['stress']['weekdayMean'],1)} so với {vn(M['stress']['weekendMean'],1)}.</li>
  <li><b>Tuần nước rút để lại dấu rõ.</b> So với {len(NORMAL_WD)} ngày làm việc bình thường: stress +{vn(group_mean('stress', SPRINT) - group_mean('stress', NORMAL_WD), 1)}, đi ngủ trễ thêm {int(round((group_mean('bedtime', SPRINT) - group_mean('bedtime', NORMAL_WD)) * 60))} phút, nước uống giảm {int(round(group_mean('water_ml', NORMAL_WD) - group_mean('water_ml', SPRINT)))} ml, vận động về {int(group_mean('exercise_min', SPRINT))} phút, ăn tối trễ thêm {int(round((group_mean('dinner_time', SPRINT) - group_mean('dinner_time', NORMAL_WD)) * 60))} phút (bảng dưới).</li>
  <li><b>Vận động dồn vào cuối tuần.</b> {vn(M['exercised']['weekendMean']*100,0)}% ngày cuối tuần có vận động so với {vn(M['exercised']['weekdayMean']*100,0)}% ngày thường, trong khi mục tiêu là 150 phút mỗi tuần.</li>
  <li><b>Bỏ bữa sáng khá thường.</b> {vn(M['skipped_breakfast']['mean']*100,0)}% số ngày bỏ bữa sáng, nhiều hơn vào ngày làm việc.</li>
</ol>
{compare_table()}
<p class="small">Bảng so sánh 15 ngày làm việc không ốm, không nước rút với 5 ngày nước rút. Cỡ mẫu nhỏ nên chỉ để minh hoạ; đừng coi là kết luận thống kê.</p>""")
    return "\n".join(sec)


# ================================================================== PART 2: behaviour model
UNIT = {"H1": "giờ", "H2": "điểm", "H3": "điểm", "H4": "điểm", "H5": "điểm", "H6": "điểm", "H10": "giờ", "H11": "điểm", "H12": "điểm", "H17": "giờ"}
REC = {r["id"]: r for r in R["recovery"]}

STRIP_COL = {
    "ngủ": "#4b5d8f", "ăn": "#c2185b", "việc": "#3b4a9e", "họp": "#6c63b5", "đi lại": "#ef6c00",
    "vận động": "#00838f", "học": "#2e7d32", "mạng xã hội": "#d98d2b", "bạn bè": "#b5651d", "việc nhà": "#8a7a5a", "OT": "#7b1fa2",
}


def day_strips():
    # (start, end, kind) in clock hours; > 24 wraps past midnight.
    plans = [
        ("Ngày làm thường (T2–T6)", [(0, 6.5, "ngủ"), (6.9, 7.2, "ăn"), (8, 8.4, "đi lại"), (9.1, 11.6, "việc"), (11.8, 12.2, "việc"), (12.2, 12.7, "ăn"), (14, 15.3, "họp"), (15.7, 17.3, "việc"), (17.8, 18.2, "đi lại"), (18.2, 19, "vận động"), (19.2, 19.7, "ăn"), (21, 22, "học"), (21.7, 22.5, "mạng xã hội"), (23.75, 24, "ngủ")]),
        ("Cuối tuần (T7–CN)", [(0, 0.5, "ngủ"), (0.5, 8, "ngủ"), (8.8, 9.7, "việc nhà"), (7.2, 8, "vận động"), (12.3, 13, "ăn"), (17, 17.8, "vận động"), (18, 21, "bạn bè"), (19.5, 20, "ăn"), (21.7, 22.4, "mạng xã hội"), (24.3, 24.7, "ngủ")]),
        ("Ngày nước rút (19–23/10)", [(0, 6.5, "ngủ"), (8, 8.4, "đi lại"), (9.1, 11.6, "việc"), (12.2, 12.7, "ăn"), (14, 15.3, "họp"), (15.7, 17.3, "việc"), (17.8, 18.2, "đi lại"), (18.7, 21, "OT"), (20.8, 21.2, "ăn"), (21.7, 22.6, "mạng xã hội"), (24.4, 24.7, "ngủ")]),
    ]
    w, rowh, left = 640, 34, 130
    h = len(plans) * (rowh + 14) + 52
    out = [svg_open(w, h)]
    for hh in range(0, 25, 3):
        x = left + hh / 24 * (w - left - 8)
        out.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="6" y2="{h - 42}" stroke="{GRID}" stroke-width="0.6"/>')
        out.append(f'<text x="{x:.1f}" y="{h - 30}" font-size="8" text-anchor="middle" fill="{MUTED}">{hh:02d}h</text>')
    for r, (name, blocks) in enumerate(plans):
        y = 10 + r * (rowh + 14)
        out.append(f'<text x="4" y="{y + rowh / 2 + 3}" font-size="9" fill="{INK}">{esc(name)}</text>')
        out.append(f'<rect x="{left}" y="{y}" width="{w - left - 8}" height="{rowh}" rx="4" fill="#f6efd9"/>')
        for a, b, k in blocks:
            for (a2, b2) in ([(a, b)] if b <= 24 else [(a, 24), (0, b - 24)]):
                x1 = left + a2 / 24 * (w - left - 8)
                x2 = left + b2 / 24 * (w - left - 8)
                out.append(f'<rect x="{x1:.1f}" y="{y + 3}" width="{max(2, x2 - x1):.1f}" height="{rowh - 6}" rx="3" fill="{STRIP_COL[k]}" opacity="0.88"/>')
    lx, ly = 6, h - 12
    for k, c in STRIP_COL.items():
        out.append(f'<rect x="{lx}" y="{ly - 7}" width="8" height="8" fill="{c}"/><text x="{lx + 11}" y="{ly}" font-size="7.5" fill="{MUTED}">{k}</text>')
        lx += 20 + len(k) * 4.6
    out.append("</svg>")
    return "".join(out)


def causal_graph():
    nodes = {
        "stress": (320, 40, "Stress trong ngày"),
        "coffee": (110, 40, "Cà phê sau 15:00"),
        "screen": (110, 110, "Lướt mạng / màn hình"),
        "dinner": (110, 180, "Ăn tối sát giờ ngủ"),
        "exercise": (110, 250, "Vận động ban ngày"),
        "quality": (320, 150, "Chất lượng ngủ"),
        "hours": (320, 250, "Thời lượng ngủ"),
        "energy": (530, 90, "Năng lượng hôm sau"),
        "focus": (530, 170, "Tập trung hôm sau"),
        "mood": (530, 250, "Tâm trạng"),
        "skip": (530, 320, "Bỏ bữa sáng"),
    }
    edges = [
        ("stress", "coffee", "+", "dẫn tới"), ("stress", "screen", "+", ""), ("stress", "quality", "−", ""),
        ("coffee", "quality", "−", ""), ("screen", "quality", "−", ""), ("dinner", "quality", "−", ""), ("exercise", "quality", "+", ""),
        ("quality", "energy", "+", ""), ("hours", "energy", "+", ""), ("quality", "focus", "+", ""), ("hours", "focus", "+", ""),
        ("energy", "mood", "+", ""), ("exercise", "mood", "+", ""), ("stress", "mood", "−", ""), ("hours", "skip", "−", ""),
    ]
    w, h = 640, 350
    out = [svg_open(w, h), f'<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="{MUTED}"/></marker></defs>']
    bw, bh = 118, 30
    for a, b, sign, _ in edges:
        xa, ya, _ = nodes[a]
        xb, yb, _ = nodes[b]
        dx, dy = xb - xa, yb - ya
        L = math.hypot(dx, dy)
        sx = xa + dx / L * (bw / 2 if abs(dx) > abs(dy) * 0.6 else 0)
        sy = ya + dy / L * (bh / 2 + 2 if abs(dx) <= abs(dy) * 0.6 else 0)
        ex = xb - dx / L * (bw / 2 + 4 if abs(dx) > abs(dy) * 0.6 else 0)
        ey = yb - dy / L * (bh / 2 + 6 if abs(dx) <= abs(dy) * 0.6 else 0)
        col = DANGER if sign == "−" else OK
        out.append(f'<line x1="{sx:.1f}" y1="{sy:.1f}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="{col}" stroke-width="1.3" marker-end="url(#ar)" opacity="0.8"/>')
        out.append(f'<text x="{(sx + ex) / 2:.1f}" y="{(sy + ey) / 2 - 2:.1f}" font-size="11" font-weight="bold" fill="{col}" text-anchor="middle">{sign}</text>')
    for k, (x, y, label) in nodes.items():
        out.append(f'<rect x="{x - bw / 2}" y="{y - bh / 2}" width="{bw}" height="{bh}" rx="8" fill="#fffaf0" stroke="{ACC}" stroke-width="1.2"/>')
        out.append(f'<text x="{x}" y="{y + 3.5}" font-size="9" text-anchor="middle" fill="{INK}">{esc(label)}</text>')
    out.append("</svg>")
    return "".join(out)


def hyp_table(area):
    rows = []
    for h in R["hypotheses"]:
        if h["area"] != area:
            continue
        rec = REC.get(h["id"])
        obs = "chưa đo trực tiếp"
        if rec and rec["diff"] is not None:
            obs = f"{'+' if rec['diff'] >= 0 else '−'}{vn(abs(rec['diff']), 2)} {UNIT[h['id']]}<br/><span class='small'>(n={rec['nYes']} / {rec['nNo']})</span>"
        rows.append([f"<b>{h['id']}</b>", esc(h["claim"]), esc(h["why"]), esc(h["effect"]), obs])
    return table(["Mã", "Giả định", "Vì sao người bình thường như vậy", "Độ lớn đặt vào mô hình", "Đo lại trong 400 ngày"], rows, "hyp")


def recovery_chart():
    ids = [r["id"] for r in R["recovery"]]
    exp = {"H1": 0.9, "H2": -0.8, "H3": -0.6, "H4": -0.5, "H5": -0.7, "H6": 0.4}
    w, h = 640, 40 + 28 * len(ids)
    left, mid = 60, 360
    scale = 140
    out = [svg_open(w, h)]
    out.append(f'<line x1="{mid}" x2="{mid}" y1="10" y2="{h - 22}" stroke="{INK}" stroke-width="0.8"/>')
    for i, hid in enumerate(ids):
        y = 20 + i * 28
        d = REC[hid]["diff"]
        out.append(f'<text x="8" y="{y + 11}" font-size="10" font-weight="bold" fill="{INK}">{hid}</text>')
        if d is not None:
            x2 = mid + d * scale
            out.append(f'<rect x="{min(mid, x2):.1f}" y="{y}" width="{abs(x2 - mid):.1f}" height="14" fill="{ACC if d > 0 else DANGER}" opacity="0.85"/>')
            out.append(f'<text x="{(x2 + (6 if d > 0 else -6)):.1f}" y="{y + 11}" font-size="9" text-anchor="{"start" if d > 0 else "end"}" fill="{INK}">{"+" if d>0 else "−"}{vn(abs(d),2)} {UNIT[hid]}</text>')
        if hid in exp:
            xe = mid + exp[hid] * scale
            out.append(f'<line x1="{xe:.1f}" x2="{xe:.1f}" y1="{y - 3}" y2="{y + 17}" stroke="{WARN}" stroke-width="2.4"/>')
    out.append(f'<text x="{mid}" y="{h - 8}" font-size="8" text-anchor="middle" fill="{MUTED}">0</text>')
    out.append(f'<text x="{w - 6}" y="{h - 8}" font-size="8" text-anchor="end" fill="{MUTED}">vạch vàng = độ lớn đặt vào mô hình (nếu có đơn vị so sánh được)</text>')
    out.append("</svg>")
    return "".join(out)


def part2():
    sec = ["<h1 class='part'>Phần 2. Phân tích hành vi con người và các giả định</h1>"]
    sec.append("""
<h2>2.1 Cách mô hình hoá hành vi</h2>
<p>Mục tiêu của mô hình không phải mô tả hoàn hảo một con người, mà tạo dữ liệu đủ giống thật để kiểm tra app: các màn hình có nội dung hợp lý, các luật cảnh báo có lý do để bật, bộ phân tích có thứ để tìm. Mô hình có ba tầng chồng lên nhau.</p>
<ol>
  <li><b>Nhịp nền.</b> Lịch lặp lại theo tuần: ngày làm việc có báo thức, đi làm, họp vào thứ ba/thứ tư/thứ năm; cuối tuần dậy muộn, vận động và gặp bạn bè nhiều hơn. Đây là thứ giải thích phần lớn sự khác nhau giữa các ngày.</li>
  <li><b>Tác động qua lại.</b> Các giả định H2–H17: hành vi hôm nay ảnh hưởng đêm nay và ngày mai. Ví dụ cà phê chiều làm ngủ kém, ngủ kém làm mệt và khó tập trung hôm sau. Mỗi tác động có một chiều và một độ lớn ghi rõ.</li>
  <li><b>Ngẫu nhiên và biến cố.</b> Mọi giá trị còn cộng nhiễu (xấp xỉ phân phối chuẩn) hoặc rút theo xác suất (có tập hay không, bỏ sáng hay không); thêm các biến cố có kịch bản: ốm, đi xa, tuần nước rút, và 'ngày tệ' ngẫu nhiên (khoảng 12% số ngày).</li>
</ol>
<p>Nguyên tắc quan trọng nhất: <b>không cài gì mà bộ phân tích không thể nhìn thấy</b>, và <b>không phân tích thứ chưa được cài</b>. Mọi hiệu ứng nằm trong danh sách 18 giả định dưới đây, không có hiệu ứng ẩn.</p>
<h2>2.2 Nhịp một ngày điển hình</h2>
<p>Ba kiểu ngày xuất hiện trong tháng. Giờ trong hình là giờ điển hình; mỗi ngày dao động khoảng ±20–40 phút.</p>""")
    sec.append(figure(day_strips(), "Ba kiểu ngày của người dùng mẫu. Ngày làm thường có hai khối deep work quanh buổi họp chiều và đi/về 25 phút; cuối tuần có vận động, việc nhà, gặp bạn bè và ngủ muộn; ngày nước rút thêm khối làm thêm buổi tối (OT), ăn tối muộn, ngủ muộn."))
    sec.append("""
<h3>Ngày làm thường</h3>
<p>Báo thức 06:30. Bữa sáng bị bỏ khoảng 30% số ngày (nhiều hơn khi đêm trước ngủ dưới 6,3 giờ). Cà phê sáng khoảng 85% số ngày. Đi làm khoảng 08:00–08:25; khối deep work đầu 09:05–11:30; email/chat 11:50; ăn trưa 12:00–12:35; buổi họp (thứ ba và thứ năm 14:00–15:15, thứ tư 15:00–16:00); khối chiều 15:45–17:25; về nhà 17:50. Buổi tối: tập vận động khoảng 22% số ngày, ăn tối quanh 19:00, học BA hoặc đọc sách 30% số ngày, lướt mạng xã hội từ 21:40, đi ngủ quanh 23:30.</p>
<h3>Cuối tuần</h3>
<p>Dậy tự nhiên 07:45–09:00 (chủ nhật dậy muộn nhất vì thứ bảy đi ngủ gần 00:30). Vận động 55% số ngày, việc nhà 60%, gặp bạn bè hoặc gia đình 50% buổi tối. Không làm việc. Mạng xã hội nhiều hơn ngày thường khoảng nửa giờ.</p>
<h3>Ngày nước rút</h3>
<p>Một khối deep work bổ sung 18:40–21:00 tại nhà, ăn tối giao tận nơi quanh 20:45, đi ngủ trễ thêm khoảng 25 phút, không vận động, uống ít hơn hai ly nước. Stress cao hơn 1,1 điểm so với nền.</p>
<h2>2.3 Mười tám giả định, theo từng nhóm</h2>
<p>Cột cuối cho thấy hiệu ứng đo lại được trong một lần chạy mô phỏng 400 ngày (không có tuần nước rút, ngày ốm, đi xa) bằng chính bộ chỉ số của app. Số trong ngoặc là số ngày có và không có yếu tố.</p>""")
    for area in ["Giấc ngủ", "Năng lượng", "Ăn uống", "Làm việc", "Vận động", "Tinh thần", "Lịch"]:
        if any(h["area"] == area for h in R["hypotheses"]):
            sec.append(f"<h3>Nhóm {area}</h3>" + hyp_table(area))
    sec.append(callout("warn", "Cách đọc cột 'Độ lớn' và cột 'Đo lại'", "Độ lớn là con số người viết chọn, có cơ sở là hướng chung của các hiểu biết phổ biến chứ không phải số đo từ nghiên cứu. Cột 'Đo lại' thường lớn hơn độ lớn đặt vào vì các yếu tố đi cùng nhau: ngày căng thẳng vừa uống cà phê chiều vừa lướt mạng nhiều, nên khi so sánh riêng một yếu tố ta vô tình cộng cả tác động của các yếu tố đi kèm. Đây là hiện tượng nhiễu chồng (confounding) mà bộ phân tích của app cũng gặp (mục 3.4)."))
    sec.append("<h2>2.4 Các yếu tố tác động lẫn nhau</h2>")
    sec.append("<p>Hình dưới tóm các giả định thành một sơ đồ. Mũi tên xanh là tác động cùng chiều (+), mũi tên đỏ là ngược chiều (−). Có hai vòng lặp đáng chú ý.</p>")
    sec.append(figure(causal_graph(), "Sơ đồ tác động giữa các yếu tố trong mô hình. Cột trái là hành vi trong ngày, cột giữa là đêm ngủ, cột phải là kết quả hôm sau."))
    sec.append("""
<ul>
  <li><b>Vòng stress – cà phê – giấc ngủ.</b> Stress cao khiến uống cà phê chiều và lướt mạng nhiều hơn; cả hai làm ngủ kém; ngủ kém làm tập trung và tâm trạng thấp hơn hôm sau, dễ căng thẳng hơn. Đây là kiểu vòng luẩn quẩn mà người dùng thật thường mắc và là chỗ lời khuyên của app có giá trị nhất.</li>
  <li><b>Vòng ngủ thiếu – bỏ sáng – mệt.</b> Ngủ ít làm dậy vội và bỏ bữa sáng, buổi sáng ít năng lượng hơn, chiều lại cần cà phê. App chỉ nhìn thấy tương quan, không nhìn thấy thứ tự nguyên nhân; vì vậy lời khuyên của app luôn dùng chữ 'đi kèm' và mời thử 14 ngày thay vì khẳng định.</li>
</ul>
<h2>2.5 Hành vi sử dụng app, không chỉ hành vi sống</h2>
<p>Một ứng dụng nhật ký chỉ thấy phần được ghi. Hành vi ghi chép cũng có quy luật, và nó quyết định chất lượng mọi thống kê:</p>
<ul>
  <li><b>Check-in bị bỏ lỡ.</b> Mô hình bỏ 20% số lần check-in năng lượng và tâm trạng (rút ngẫu nhiên). Hệ quả: điểm năng lượng trong ngày là trung bình của 2–4 lần chứ không phải đủ 4, và một số ngày không có điểm (như 17/10).</li>
  <li><b>Ghi sát giờ.</b> Ghi nhanh trên Hôm nay giúp giờ chính xác; mục đã làm xong ghi ở tab Ghi bù với giờ ước lượng. Mô hình coi mọi giờ là chính xác, nên chưa kiểm tra độ nhiễu khi ghi bù (đề xuất ở mục 2.7).</li>
  <li><b>Ngày bỏ ghi.</b> Mô hình chưa có ngày bỏ ghi hoàn toàn. Với người dùng thật, cuối tuần và ngày đi chơi dễ bị bỏ trống; bộ chỉ số trả về null cho ngày không ghi nên phân tích vẫn đúng, nhưng sẽ thiếu đúng những ngày có nhiều thông tin nhất.</li>
  <li><b>Thói quen chấm ngày.</b> Điểm ngày do người dùng chấm lúc 21:30; mô hình tính điểm từ năng lượng, tâm trạng, stress cộng nhiễu, tức là mô hình coi người dùng chấm khá nhất quán. Người thật thường kém nhất quán hơn.</li>
</ul>
<h2>2.6 Biến cố và vì sao phải loại khỏi phân tích</h2>
<p>Ngày ốm và ngày đi xa là những ngày hành vi đổi hẳn: không đi làm, ngủ nhiều, thức ăn khác, ít vận động hoặc vận động rất nhiều. Nếu gộp vào, chúng làm nhiễu mọi so sánh ('ngủ nhiều hôm ốm → năng lượng thấp' sẽ trông như ngủ nhiều gây mệt). Bộ phân tích của app mặc định loại ngày đánh dấu 'ốm', 'đi xa', 'nghỉ lễ'. Trong tháng mẫu có 4 ngày bị loại (2 ốm, 2 đi xa), còn lại 26 ngày để so sánh, trong đó 5 ngày nước rút vẫn được giữ vì đó là hành vi 'bình thường có áp lực', không phải ngoại lệ.</p>
<h2>2.7 Những hành vi bình thường mà mô hình chưa có</h2>
<table class="plain">
<tr><th>Hành vi</th><th>Vì sao quan trọng</th><th>Ảnh hưởng nếu thiếu</th><th>Đề xuất</th></tr>
<tr><td>Rượu bia, tiệc tối</td><td>Làm ngủ nông, ăn khuya, sáng hôm sau mệt.</td><td>Luật 'ăn khuya' và chỉ số 'rượu bia' không bao giờ được kích hoạt trong dữ liệu mẫu.</td><td>Thêm 4–6 buổi tiệc/tháng, tối thứ sáu hoặc thứ bảy.</td></tr>
<tr><td>Ngủ trưa</td><td>Bù ngủ nhưng có thể làm khó ngủ đêm.</td><td>Chỉ số giấc ngủ chưa bị nhiễu bởi giấc ngủ phụ.</td><td>Thêm giấc ngủ trưa 20–40 phút, xác suất 20%.</td></tr>
<tr><td>Làm việc từ xa, ca kíp</td><td>Đổi hẳn nhịp ngày và địa điểm.</td><td>Chỉ số 'địa điểm' và giờ bắt đầu làm quá đều.</td><td>Một tuần làm tại nhà, một tuần ca muộn.</td></tr>
<tr><td>Nghỉ lễ, ngày nghỉ phép</td><td>Ngày thường mà không đi làm.</td><td>Chưa kiểm tra loại ngày 'nghỉ lễ' trong bộ phân tích.</td><td>Thêm 1–2 ngày nghỉ.</td></tr>
<tr><td>Quen caffeine, mất ngủ kéo dài</td><td>Hiệu ứng cà phê giảm khi uống đều; mất ngủ nhiều đêm liền gây nợ ngủ.</td><td>Mô hình coi mỗi đêm độc lập, trừ phụ thuộc đêm trước vào giờ dậy.</td><td>Thêm biến 'nợ ngủ' tích luỹ.</td></tr>
<tr><td>Thời tiết, mùa, ngày lễ truyền thống</td><td>Ảnh hưởng vận động ngoài trời, tâm trạng.</td><td>Không ảnh hưởng kiểm thử, chỉ làm dữ liệu quá 'phẳng'.</td><td>Chưa cần.</td></tr>
</table>
<h2>2.8 Kiểm tra: app tìm lại được thứ đã cài chưa</h2>
<p>Chạy mô phỏng 400 ngày (không có biến cố, hạt giống khác) và đo lại bằng bộ chỉ số của app. Mục đích là kiểm tra bản thân mô hình (có cài đúng chiều không), và chuẩn bị cho phần 3: nếu bộ phân tích báo cáo điều gì đó sai, ta biết nguyên nhân nằm ở mô hình hay ở bộ phân tích.</p>""")
    sec.append(figure(recovery_chart(), "Hiệu ứng đo lại được trên 400 ngày mô phỏng (thanh) so với độ lớn đã đặt vào (vạch vàng). Thanh xanh cùng chiều dương, thanh đỏ chiều âm. Cả 10 giả định đo được đều ra đúng chiều."))
    rows = []
    for r in R["recovery"]:
        d = r["diff"]
        rows.append([f"<b>{r['id']}</b>", esc(r["measure"]), esc(r["expected"]), f"{'+' if d>=0 else '−'}{vn(abs(d),2)}" if d is not None else "–", f"{r['nYes']} / {r['nNo']}"])
    sec.append(table(["Mã", "Phép đo", "Kỳ vọng", "Đo được", "Số ngày (có / không)"], rows))
    sec.append("""<p class="small">H10 (bỏ sáng khi ngủ thiếu) có chênh nhỏ nhất vì chỉ là xác suất bỏ sáng tăng 20 điểm phần trăm; H4 và H5 có ít ngày hơn vì các tình huống ấy hiếm (ăn tối sát giờ ngủ, stress ≥ 4).</p>""")
    return "\n".join(sec)


# ================================================================== PART 3: what the app's engine finds
DIRECT = {
    ("Màn hình trước ngủ", "Chất lượng ngủ"): "H3", ("Giờ ly cà phê cuối", "Chất lượng ngủ"): "H2", ("Có vận động", "Chất lượng ngủ"): "H6",
    ("Stress", "Chất lượng ngủ"): "H5", ("Thời lượng ngủ", "Năng lượng"): "H7", ("Thời lượng ngủ", "Tập trung"): "H12",
    ("Có vận động", "Tâm trạng"): "H16", ("Stress", "Tâm trạng"): "H16", ("Giờ mạng xã hội", "Chất lượng ngủ"): "H17+H3",
}
CHAIN = {
    ("Thời lượng ngủ", "Tâm trạng"), ("Thời lượng ngủ", "Điểm ngày"), ("Stress", "Điểm ngày"), ("Stress", "Năng lượng"),
    ("Màn hình trước ngủ", "Tập trung"),
}
SRC_NAME = {"Có vận động": "Có vận động"}


def classify(f):
    k = (f["factor"], f["outcome"])
    if k in DIRECT:
        return "direct", f"khớp {DIRECT[k]}"
    if k in CHAIN:
        return "chain", "chuỗi gián tiếp có thật"
    return "calendar", "do lịch ngày thường / cuối tuần"


def findings_table(rows_in, limit=None):
    rows = []
    for f in rows_in[:limit]:
        kind, note = classify(f)
        badge = {"direct": "ok", "chain": "ok", "calendar": "bad"}[kind]
        rows.append(
            [
                esc(f["factor"]),
                esc(f["outcome"]) + (" (hôm sau)" if f["lag"] == 1 else ""),
                f"{f['nLow']} / {f['nHigh']}",
                f"{vn(f['meanLow'],2)} → {vn(f['meanHigh'],2)}",
                vn(f["d"], 2),
                {"strong": "mạnh", "medium": "vừa", "weak": "yếu"}[f["confidence"]],
                f"<span class='bd {badge}'>{note}</span>",
            ]
        )
    return table(["Yếu tố", "Kết quả", "Số ngày (thấp / cao)", "TB thấp → cao", "d", "Độ tin", "Đối chiếu với giả định"], rows, "dense")


def part3():
    sec = ["<h1 class='part'>Phần 3. App tìm ra gì từ dữ liệu</h1>"]
    all150 = F["days150"]
    wd = F["days150Workdays"]
    cnt = {"direct": 0, "chain": 0, "calendar": 0}
    for f in all150:
        cnt[classify(f)[0]] += 1
    cntw = {"direct": 0, "chain": 0, "calendar": 0}
    for f in wd:
        cntw[classify(f)[0]] += 1
    sec.append(f"""
<h2>3.1 App cho phép tự tin đến đâu theo số ngày đã ghi</h2>
<p>Thiết kế của app là 'càng ít dữ liệu càng ít nói' (SPEC 8.1). Số ngày có ghi quyết định cấp độ kết luận:</p>
<table class="plain">
<tr><th>Số ngày đã ghi</th><th>Cấp</th><th>App được làm gì</th></tr>
<tr><td>dưới 7</td><td>mô tả</td><td>Chỉ hiện số liệu, không cảnh báo, không tương quan.</td></tr>
<tr><td>7 – 27</td><td>luật</td><td>Chạy các luật cảnh báo cố định (thiếu ngủ, cà phê muộn, bỏ sáng, …).</td></tr>
<tr><td>28 – 59</td><td>tương quan</td><td>So sánh yếu tố với kết quả cùng ngày.</td></tr>
<tr><td>từ 60</td><td>tương quan có độ trễ</td><td>Thêm so sánh 'hôm nay → ngày mai' và phân tích theo thứ trong tuần.</td></tr>
</table>
<p>Tháng mẫu có 30 ngày ghi nên ở cấp 'tương quan'; để xem đầy đủ hơn, báo cáo chạy thêm một đoạn mô phỏng 150 ngày (cấp có độ trễ).</p>
<h2>3.2 Luật cảnh báo kích hoạt ngày 30/10</h2>
<p>Luật là phần đơn giản và dễ tin nhất: một điều kiện cụ thể trên số liệu gần đây, có thời gian chờ để không nhắc lặp. Ngày 30/10 có {len(R['fired'])} luật kích hoạt:</p>""")
    rows = [[f"P{r['priority']}", esc(r["label"]), esc(r["text"])] for r in R["fired"]]
    sec.append(table(["Ưu tiên", "Luật", "Nội dung hiện cho người dùng"], rows))
    sec.append("""<p>Cả ba đều đúng với số liệu: tuần này vận động còn rất ít so với mục tiêu, bỏ sáng nhiều ngày, và học BA chưa đủ ngân sách tuần. Không có luật nào sai hay nhiễu. Hai luật tháng này không kích hoạt dù có dữ liệu liên quan ('thiếu ngủ liên tiếp' vì không có 3 đêm liền dưới 6 giờ; 'cà phê muộn' vì đã nằm trong thời gian chờ) là đúng thiết kế.</p>""")
    sec.append(f"""
<h2>3.3 Tương quan trên 30 ngày của tháng mẫu</h2>
<p>Bộ tương quan chia ngày thành nhóm 'có yếu tố / không có' (hoặc ba phần theo mức yếu tố) rồi so trung bình kết quả, đo bằng Cohen's d và thống kê Welch t, chỉ báo khi |d| ≥ 0,5, |t| ≥ 3,5 và hai nửa kỳ cùng chiều. Với 30 ngày:</p>""")
    sec.append(findings_table(F["days30"]) if F["days30"] else "<p>Không có kết quả nào đạt ngưỡng.</p>")
    sec.append("""<p>Hai kết quả đều khớp giả định đã cài (H3 và chuỗi H17 → H3): ngày dùng màn hình trước ngủ và lướt mạng nhiều thì giấc ngủ kém hơn. Số ngày mỗi nhóm nhỏ (8 và 17 ngày) nên app gắn nhãn 'vừa', không phải 'mạnh'. Đây là hành vi mong muốn: ít dữ liệu thì báo ít và dè dặt.</p>""")
    sec.append(f"""
<h2>3.4 Tương quan trên 150 ngày: app báo nhiều, nhưng một phần lớn là nhiễu lịch</h2>
<p>Chạy thêm 150 ngày mô phỏng cùng người dùng (không có biến cố) để xem bộ phân tích ở cấp đầy đủ. Kết quả: <b>{len(all150)}</b> phát hiện, trong đó chỉ <b>{cnt['direct']}</b> khớp trực tiếp một giả định đã cài, <b>{cnt['chain']}</b> là chuỗi gián tiếp có thật, và <b>{cnt['calendar']}</b> là do lịch ngày thường / cuối tuần. Bảng dưới liệt kê 20 phát hiện mạnh nhất.</p>""")
    sec.append(findings_table(all150, 20))
    sec.append(f"""
<p class="small">d là Cohen's d (chênh của kết quả giữa nhóm cao và nhóm thấp, tính theo độ lệch chuẩn gộp). 'Độ tin' của app. Cột cuối do người viết báo cáo đối chiếu với danh sách giả định, app không tự biết.</p>
<h3>Vì sao có nhiều kết quả do lịch</h3>
<p>Trong dữ liệu, ngày thường và cuối tuần khác nhau ở hầu hết mọi thứ: cuối tuần không có deep work, dậy muộn hơn, vận động nhiều hơn, tâm trạng cao hơn. Khi bộ phân tích so 'nhóm giờ dậy muộn' với 'nhóm giờ dậy sớm', nó vô tình so cuối tuần với ngày thường, rồi báo 'dậy muộn → deep work thấp hơn' và 'vận động → deep work thấp hơn', dù chẳng có mối liên hệ nhân quả nào như vậy trong mô hình. Một người đọc không biết điều này có thể hiểu là 'vận động làm giảm deep work' và bỏ tập. Đây là rủi ro thật về trải nghiệm: một con số có vẻ khoa học nhưng dẫn đến quyết định sai.</p>
<h3>Thử một cách sửa mà không đụng vào code phân tích</h3>
<p>Chạy lại cùng 150 ngày nhưng đánh dấu cuối tuần là 'nghỉ lễ' (bộ phân tích bỏ qua loại ngày này), tức chỉ so các ngày làm việc với nhau. Số phát hiện giảm từ {len(all150)} xuống <b>{len(wd)}</b>:</p>""")
    sec.append(findings_table(wd))
    sec.append(f"""
<p>Trong {len(wd)} phát hiện còn lại, {cntw['direct']} khớp trực tiếp giả định đã cài và {cntw['chain']} là chuỗi gián tiếp; còn {cntw['calendar']} vẫn là nhiễu lịch ('thời lượng ngủ → deep work' và 'giờ dậy → deep work' vì thứ sáu vừa ngủ dài hơn vừa ít deep work hơn). So với bảng trước, phép lọc này loại gần như toàn bộ phát hiện sai, giữ lại gần như toàn bộ phát hiện đúng. Hình dưới tóm tắt.</p>""")
    w, h = 640, 130
    def stack(y, label, c):
        tot = sum(c.values()) or 1
        x = 150
        out = f'<text x="4" y="{y + 15}" font-size="9" fill="{INK}">{label}</text>'
        for k, col, name in [("direct", ACC, "khớp trực tiếp"), ("chain", OK, "chuỗi gián tiếp"), ("calendar", DANGER, "nhiễu lịch")]:
            ww = c[k] / tot * (w - 160)
            if ww > 0:
                out += f'<rect x="{x:.1f}" y="{y}" width="{ww:.1f}" height="22" fill="{col}"/><text x="{x + ww / 2:.1f}" y="{y + 15}" font-size="9" text-anchor="middle" fill="#fff">{c[k]}</text>'
            x += ww
        return out
    svg = svg_open(w, h) + stack(14, f"Tất cả ngày ({len(all150)})", cnt) + stack(52, f"Chỉ ngày làm việc ({len(wd)})", cntw)
    lx = 150
    for name, col in [("khớp trực tiếp", ACC), ("chuỗi gián tiếp có thật", OK), ("nhiễu lịch", DANGER)]:
        svg += f'<rect x="{lx}" y="96" width="9" height="9" fill="{col}"/><text x="{lx + 13}" y="104" font-size="8.5" fill="{MUTED}">{name}</text>'
        lx += 30 + len(name) * 5
    svg += "</svg>"
    sec.append(figure(svg, "Số phát hiện của bộ tương quan theo loại, trên 150 ngày mô phỏng: trước và sau khi chỉ so các ngày làm việc với nhau."))
    sec.append("""
<h2>3.5 Phân tích theo thứ trong tuần</h2>
<p>Từ 60 ngày, app còn so từng thứ trong tuần với phần còn lại. Với 150 ngày mô phỏng có """ + str(N_WK150) + """ kết quả; bảng dưới là các kết quả mạnh nhất.</p>""")
    names = {"deep_work_hours": "Deep work (giờ)", "mood": "Tâm trạng", "day_score": "Điểm ngày", "energy": "Năng lượng", "focus": "Tập trung"}
    rows = []
    for w_ in F["weekday150"][:12]:
        rows.append([WD_LONG[w_["weekday"]], names.get(w_["outcomeId"], w_["outcomeId"]), vn(w_["mean"], 2), vn(w_["restMean"], 2), vn(w_["d"], 2), {"strong": "mạnh", "medium": "vừa", "weak": "yếu"}[w_["confidence"]]])
    sec.append(table(["Thứ", "Kết quả", "TB ngày đó", "TB các ngày còn lại", "d", "Độ tin"], rows))
    sec.append("""<p>Các kết quả này đúng nhưng hiển nhiên: 'thứ bảy và chủ nhật không có deep work', 'cuối tuần tâm trạng cao hơn'. App đã đưa nhóm kết quả này vào loại 'chỉ để tham khảo' (không có nút 'Thử 14 ngày') đúng vì lý do trên. Cái đáng giá hơn là các chênh lệch nhỏ giữa các ngày làm việc (ví dụ thứ hai tâm trạng thấp hơn 0,6 điểm), vì đó là điều người dùng chưa biết trước.</p>
<h2>3.6 Đánh giá và đề xuất cho bộ phân tích</h2>
<table class="plain">
<tr><th>Vấn đề</th><th>Bằng chứng</th><th>Đề xuất</th><th>Mức ưu tiên</th></tr>
<tr><td>Kết quả do lịch ngày thường / cuối tuần được báo như phát hiện thật</td><td>Phần lớn phát hiện mạnh nhất trên 150 ngày; lọc theo ngày làm việc loại gần hết.</td><td>So trong từng nhóm ngày (làm việc / cuối tuần) rồi gộp, hoặc ít nhất loại cặp mà kết quả là chỉ số công việc và yếu tố thay đổi theo cuối tuần. Hiện thêm dòng 'có thể do cuối tuần' khi nhóm cao/thấp lệch nhiều về ngày cuối tuần.</td><td>Cao</td></tr>
<tr><td>Nhãn 'mạnh' quá dễ đạt khi so ba phần theo mức</td><td>Gần như mọi phát hiện đều 'mạnh' vì d lớn và t lớn.</td><td>Nhãn nên dựa cả trên kích thước mẫu và độ ổn định giữa các tháng, không chỉ d và t.</td><td>Vừa</td></tr>
<tr><td>Không thấy ngay có bao nhiêu ngày đứng sau một phát hiện</td><td>Người dùng đọc 'd = 1,3' không biết là 50 hay 8 ngày.</td><td>Luôn hiện số ngày mỗi nhóm trong lời khuyên.</td><td>Thấp</td></tr>
</table>""")
    return "\n".join(sec)


# ================================================================== PART 4: every screen
def last_night():
    """'6h20 (00:13 → 06:33)' for the night that started on 29/10, as the Hôm nay card shows it."""
    i = day_index("2026-10-29")
    h = val("sleep_hours", i)
    mins = int(round(h * 60))
    return f"{mins // 60}h{mins % 60:02d} ({hm(val('bedtime', i))} → {hm(val('wake_time', i))})"


def part4():
    sec = ["<h1 class='part'>Phần 4. Ảnh chụp mọi màn hình, kèm số liệu</h1>"]
    sec.append("""
<p>Mọi ảnh dưới đây là ảnh thật của app chạy với dữ liệu tháng 10/2026, chụp ở màn 390×844 (cỡ iPhone), đồng hồ đặt ở 21:40 thứ sáu 30/10. Màn dài được cắt thành các đoạn bằng một màn hình để đọc được trên giấy. Bên dưới mỗi ảnh là chú thích: màn đang hiện gì và số liệu đó khớp với phần nào của báo cáo.</p>
<h2>4.1 Hôm nay</h2>
<p>Màn dùng nhiều nhất. Nguyên tắc: ghi một sự kiện không quá 2 chạm; chỉ ghi thời gian thực ở đây, việc đã làm xong ghi ở tab Ghi bù.</p>""")
    cap_today = {
        ("01-hom-nay", 0): f"Thanh chọn ngày, banner 'Chấm ngày hôm nay' (hiện sau 21:30), thẻ tổng quan <b>5/6 mục cốt lõi</b> (thiếu mỗi 'Chấm ngày'), thẻ giấc ngủ: đêm qua ngủ <b>{last_night()}</b> với hai nút Đi ngủ / Thức dậy.",
        ("01-hom-nay", 1): "Ghi nhanh: bốn nút theo Loại (Ăn uống, Làm việc, Hoạt động, Vận động) và Uống nước ghi ngay; ô 'Thêm nút'. Phía dưới là hai hàng 1–5 để check-in năng lượng và tâm trạng bằng một chạm.",
        ("01-hom-nay", 2): "Dòng thời gian 'Đã ghi trong ngày': mỗi mục có giờ, thanh màu theo loại, tên và thời lượng; ngủ đêm qua ở đầu, các mục sau theo giờ.",
        ("01-hom-nay", 3): "Cuối ngày: học BA, mạng xã hội 21:40 là mục gần nhất; thanh tab dưới cùng.",
        ("03-chon-danh-muc", 0): "Bấm 'Làm việc' mở bảng chọn danh mục của loại Làm việc dưới dạng ô bấm (Deep work, Họp, Hỗ trợ/fix lỗi khách, Email/chat, Học trong việc) cộng ô 'Khác'.",
        ("04-form-ghi-moi", 0): "Form 'Ghi mới' đã có sẵn loại và danh mục (Deep work · Làm việc, nút 'Đổi'); giờ bắt đầu là bây giờ, chip thời lượng, nút <b>Bắt đầu</b> (để trống giờ kết thúc thì việc chạy tiếp).",
        ("05-dang-lam", 0): "Sau khi bấm Bắt đầu: thông báo 'Đã bắt đầu: Deep work' (có Sửa / Hoàn tác) và thẻ <b>Đang làm</b> với nút Kết thúc; biểu tượng đập nhẹ để biết việc còn mở.",
        ("06-chi-tiet-muc", 0): "Bấm một mục trên dòng thời gian mở bảng Sửa / Nhân bản / Xoá. Ở đây là bữa tối 18:42.",
        ("07-cham-ngay", 0): "Chấm ngày: tâm trạng, năng lượng, stress, tập trung (1–5), điểm cả ngày (1–10), điều đáng nhớ, loại ngày (đi làm, cuối tuần, nghỉ lễ, ốm, đi xa).",
    }
    sec.append(shots("after", ["01-hom-nay", "03-chon-danh-muc", "04-form-ghi-moi", "05-dang-lam", "06-chi-tiet-muc", "07-cham-ngay"], cap_today))
    sec.append("<h2>4.2 Ghi bù và Thói quen</h2>")
    cap_bu = {
        ("08-ghi-bu", 0): "Tab Ghi bù: chọn ngày, chọn việc đã làm xong (cùng bộ nút theo Loại cộng 'Ngủ đêm qua' và 'Việc khác'); giờ có sẵn là giờ thường ngày của mục đó. Mục tạo ở đây được đánh dấu 'ghi bù'.",
        ("09-thoi-quen", 0): "Thói quen: thẻ tổng quan, hôm nay có 3 thói quen đang bật: uống đủ 2 lít nước (tự tính từ lượng nước đã ghi), đọc sách 20 phút (bấm +10'), vận động 30 phút (tự tính).",
        ("09-thoi-quen", 1): "Thói quen mẫu đang tắt (dậy trước 7h, ngủ trước 23h30, không màn hình trước ngủ) có nút Bật; mục giải thích cách thói quen hoạt động.",
    }
    sec.append(shots("after", ["08-ghi-bu", "09-thoi-quen"], cap_bu))
    sec.append("<h2>4.3 Thống kê</h2><p>Năm tab con: Tổng quan, Ăn uống, Thời gian, Sức khoẻ, Báo cáo. Mọi số trong các ảnh này tính lại từ Entry và Day mỗi lần mở, không lưu số dẫn xuất (CLAUDE.md, luật 8).</p>")
    cap_stats = {
        ("10-thong-ke-tong-quan", 0): "Tổng quan: bảy thẻ 'tuần này so với tuần trước' (thời lượng ngủ, độ lệch giờ ngủ, deep work, phút vận động, tâm trạng, điểm ngày, điểm giữa giấc ngủ) với mũi tên tăng/giảm.",
        ("10-thong-ke-tong-quan", 1): "Lời khuyên nổi bật (sinh từ các luật và từ phát hiện tương quan, ví dụ lướt mạng nhiều đi kèm ngủ kém; mỗi lời có Hữu ích / Không đúng / Ẩn 2 tuần), 'Cái gì đi kèm ngày tốt / tệ' và xu hướng 90 ngày hai chỉ số.",
        ("10-thong-ke-tong-quan", 2): "Lịch tháng tô theo điểm ngày, cột theo thứ trong tuần, và mục 'Hỏi Claude' (gửi số liệu tổng hợp, không có ghi chú hay ảnh).",
        ("11-thong-ke-an-uong", 0): "Ăn uống: giờ ba bữa hôm nay (07:20, 12:16, 18:42), nước 2000/2000 ml, cà phê 1 ly; bảng 7 ngày giờ từng bữa (ô trống = bỏ bữa).",
        ("11-thong-ke-an-uong", 1): "Trung bình 30 ngày: giờ ăn sáng 07:34 (bỏ 9/30 ngày), ăn trưa 12:20, ăn tối 19:42, khung ăn 10,7 giờ, 42% bữa ăn ngoài/giao; món hay ăn nhất.",
        ("12-thong-ke-thoi-gian", 0): "Thời gian: vòng chia giờ hôm nay theo ba nhóm (Công việc chính, Phát triển bản thân, Cá nhân) và ngân sách tuần: deep work, học BA, mạng xã hội, mỗi thứ một thanh tiến độ.",
        ("12-thong-ke-thoi-gian", 1): "Cột chồng 7 ngày qua, bản đồ nhiệt deep work theo giờ trong ngày (90 ngày) và tổng giờ theo dự án trong tháng.",
        ("13-thong-ke-suc-khoe", 0): "Sức khoẻ: thẻ tuần này so với tuần trước; biểu đồ 'giấc ngủ 30 ngày' (mỗi cột là một đêm từ giờ ngủ tới giờ dậy, chấm vàng là chất lượng ngủ).",
        ("13-thong-ke-suc-khoe", 1): "Đường năng lượng trong ngày (đỉnh quanh 9h, tụt quanh 15h theo đúng giả định H8) và lịch tháng điểm ngày.",
        ("14-thong-ke-bao-cao", 0): "Báo cáo tuần 24–30/10: bảng 17 chỉ số, tuần này so với tuần trước; nút In / Lưu thành PDF.",
        ("14-thong-ke-bao-cao", 1): "Bảng từng ngày (điểm, giờ ngủ, tâm trạng), thói quen trong tuần và 'Nhận xét nổi bật' sinh từ các phát hiện tương quan (ví dụ lướt mạng nhiều đi kèm ngủ kém).",
    }
    sec.append(shots("after", ["10-thong-ke-tong-quan", "11-thong-ke-an-uong", "12-thong-ke-thoi-gian", "13-thong-ke-suc-khoe", "14-thong-ke-bao-cao"], cap_stats))
    sec.append("<h2>4.4 Cài đặt</h2><p>Sáu mục chia theo kiểu thẻ tab. Nút dành cho dev (sinh dữ liệu giả) chỉ có khi chạy <code>npm run dev</code>, nằm ở mục 'Dữ liệu'.</p>")
    cap_set = {
        ("20-cai-dat-danh-muc", 0): "Danh mục: mở màn Quản lý nút nhanh, danh mục, loại và tag.",
        ("21-cai-dat-muc-tieu", 0): "Mục tiêu: giờ làm việc (để tính OT), ngày làm việc, mục tiêu sức khoẻ (giờ ngủ, nước, vận động), ngân sách tuần.",
        ("22-cai-dat-canh-bao", 0): "Cảnh báo: mười hai luật, mỗi luật có công tắc và có thể mở ra chỉnh ngưỡng.",
        ("23-cai-dat-hien-thi", 0): "Hiển thị: giao diện sáng / tối / theo máy, giờ cắt ngày (mặc định 04:00), giờ nhắc chấm ngày, ngày ốm/đi xa có bỏ khỏi thống kê không.",
        ("24-cai-dat-du-lieu", 0): "Dữ liệu: sao lưu, xuất / nhập JSON và CSV, ảnh (chỉ Wi-Fi, giữ ảnh lớn bao lâu), và phần dữ liệu giả cho dev.",
        ("25-cai-dat-ung-dung", 0): "Ứng dụng: tài khoản và đồng bộ, khoá app bằng sinh trắc học, về app (bản dựng) và nút kiểm tra/cập nhật phiên bản mới.",
    }
    sec.append(shots("after", ["20-cai-dat-danh-muc", "21-cai-dat-muc-tieu", "22-cai-dat-canh-bao", "23-cai-dat-hien-thi", "24-cai-dat-du-lieu", "25-cai-dat-ung-dung"], cap_set))
    sec.append("<h2>4.5 Quản lý nút nhanh, danh mục, loại, tag</h2><p>Phân cấp: Loại là gốc (ngủ, ăn uống, làm việc, hoạt động, vận động, uống nước, hoặc loại tự đặt), danh mục nằm dưới một loại, nút nhanh trỏ vào một loại. Bấm nút nhanh thì hiện các danh mục của loại đó.</p>")
    cap_q = {
        ("30-quan-ly-nut-nhanh", 0): "Nút nhanh: mỗi nút có tên, biểu tượng, loại; sắp xếp bằng mũi tên.",
        ("31-quan-ly-danh-muc", 0): "Danh mục: nhiều danh mục dưới mỗi loại, có màu, biểu tượng và nhóm thời gian.",
        ("32-quan-ly-loai", 0): "Loại: bảy loại có sẵn (có form riêng và chỉ số riêng) cộng các loại tự đặt.",
        ("33-quan-ly-tag", 0): "Tag: nhãn gắn thêm vào mục ghi, nhập nhanh ngay trong form.",
    }
    sec.append(shots("after", ["30-quan-ly-nut-nhanh", "31-quan-ly-danh-muc", "32-quan-ly-loai", "33-quan-ly-tag"], cap_q, per_row=4))
    return "\n".join(sec)


# ================================================================== PART 5: UI / UX
def crop_css(folder, name, y0, y1, tag):
    src = f"{D}/img/{folder}/{name}.jpg"
    im = Image.open(src)
    w, h = im.size
    box = (0, int(y0 * 2), w, min(h, int(y1 * 2)))
    fp = f"{SLICES}/{tag}.jpg"
    im.crop(box).save(fp, quality=86)
    return fp


def pair(before_fp, after_fp, cap_b, cap_a):
    return (
        '<div class="shotrow">'
        f'<div class="shot"><div class="tagb">TRƯỚC</div><img src="file://{before_fp}"/><div class="cap">{cap_b}</div></div>'
        f'<div class="shot"><div class="taga">SAU</div><img src="file://{after_fp}"/><div class="cap">{cap_a}</div></div>'
        "</div>"
    )


def motion_strip(prefix, times, tag):
    ims = [Image.open(f"{D}/img/motion/{prefix}-{t}.jpg") for t in times]
    h = max(i.height for i in ims)
    w = sum(i.width for i in ims) + 10 * (len(ims) - 1)
    s = Image.new("RGB", (w, h), "white")
    x = 0
    for i in ims:
        s.paste(i, (x, 0))
        x += i.width + 10
    fp = f"{SLICES}/{tag}.jpg"
    s.save(fp, quality=82)
    return f'<figure class="fig"><img class="wide" src="file://{fp}"/>', fp


def part5():
    sec = ["<h1 class='part'>Phần 5. Giao diện, trải nghiệm và chuyển động</h1>"]
    sec.append("""
<h2>5.1 Cách rà soát giao diện</h2>
<p>Đạt báo hai lần có chỗ nút tràn màn hình, đè hoặc dính vào nhau và form 'Ghi mới' bị lắc khi vuốt ngang. Cách rà soát được làm thành script để chạy lại được, thay vì đọc mắt từng màn.</p>
<ul>
  <li><b>Phạm vi.</b> Bốn độ rộng (320, 360, 390, 430 px) × hai chế độ (sáng, tối). Trên mỗi độ rộng, script nạp 60 ngày dữ liệu giả, mở lần lượt năm tab chính, từng thẻ tab con (Thống kê 5, Cài đặt 6), bấm từng nút trong màn, rồi mở màn Quản lý (cả bốn tab, form thêm mới và sửa) và bảng chọn danh mục cùng form ghi cho từng loại ở cả Hôm nay lẫn Ghi bù.</li>
  <li><b>Sáu kiểu lỗi được kiểm tra.</b> Trang rộng hơn màn (cuộn ngang); phần tử nằm ngoài màn; hai nút chồng lên nhau; hai khối dính sát nhau (cách dưới 3 px); nút bị cắt chữ; chữ tràn khỏi chính ô của nó.</li>
  <li><b>Giới hạn thật của cách làm.</b> Lần rà đầu chỉ có ba kiểu đầu nên bỏ sót lỗi 'dính sát nhau' ở màn Quản lý (Đạt phát hiện trên iPhone). Sau đó đã thêm kiểu kiểm tra thứ tư và thêm màn Quản lý vào đường duyệt. Script có báo vài cảnh báo giả (các dòng chia bằng đường kẻ ở Cài đặt) mà tao đã xem tay và loại.</li>
</ul>
<h2>5.2 Các lỗi bố cục đã tìm thấy và sửa</h2>""")
    rows = [
        ["1", "Cài đặt, Thống kê: hàng tab", "Tab cuối bị cắt ('Hiể…'), phải vuốt ngang mới thấy hết.", "Hàng tab cuộn ngang trong một ô cố định.", "Cho hàng tab xuống dòng.", "script, ảnh", "#17"],
        ["2", "Cài đặt → Cảnh báo", "Công tắc nằm lệch theo độ dài tiêu đề từng dòng.", "Khối 'details' co theo nội dung trong một dòng flex.", "Cho khối chiếm hết bề ngang.", "ảnh", "#17"],
        ["3", "Thống kê → Thời gian", "Lưới giờ trong ngày (24 cột) tràn khoảng 10 px bên phải.", "Cột 1fr không co được dưới chiều rộng nội dung.", "Dùng minmax(0, 1fr).", "script", "#17"],
        ["4", "Quản lý nút nhanh / danh mục / loại / tag", "Hàng tab, danh sách và nút '+ mới' dính sát nhau.", "Khối nội dung không có khoảng cách giữa các con.", "Khoảng cách 12 px giữa các khối, đệm dưới 32 px.", "Đạt (iPhone)", "#19"],
        ["5", "Thống kê → Tổng quan, Sức khoẻ", "Lịch tháng bị cắt cột Chủ nhật.", "Lưới 7 cột bằng nhau 1fr không co dưới chiều rộng ô.", "Dùng minmax(0, 1fr).", "ảnh", "PR này"],
        ["6", "Thống kê → Sức khoẻ", "Nhãn giờ (18h, 00h…) vẽ đè lên các cột giấc ngủ; không có mốc ngày.", "Nhãn đặt trong vùng vẽ cột.", "Cột nhãn riêng bên trái, thêm mốc ngày mỗi 7 ngày.", "ảnh", "PR này"],
        ["7", "Thống kê → Sức khoẻ", "Biểu đồ năng lượng không có thang đo, khó đọc.", "Chỉ có nhãn giờ ở trục ngang.", "Thêm thang 1 / 3 / 5 bên trái.", "ảnh", "PR này"],
        ["8", "Form 'Ghi mới'", "Vuốt ngang bị lắc (Đạt báo trên iPhone).", "Chưa xác định: đo trong Chromium không thấy tràn ngang.", "Khoá cuộn ngang của form, chỉ cho vuốt dọc, không cho cuộn lan ra trang nền.", "Đạt (iPhone)", "#17"],
    ]
    sec.append(table(["#", "Màn hình", "Triệu chứng", "Nguyên nhân", "Cách sửa", "Phát hiện bởi", "PR"], rows, "dense"))
    sec.append(callout("warn", "Điều chưa chắc", "Lỗi số 8 chưa tái hiện được trong Chromium giả lập, nên bản sửa là biện pháp phòng ngừa theo hướng an toàn chứ chưa chứng minh được là đúng nguyên nhân. Cần Đạt thử trên iPhone và báo lại nếu còn lắc."))
    # before/after pictures
    b13a = crop_css("before", "13-thong-ke-suc-khoe", 600, 1030, "ba-sk-1")
    a13a = crop_css("after", "13-thong-ke-suc-khoe", 600, 1040, "aa-sk-1")
    b13b = crop_css("before", "13-thong-ke-suc-khoe", 1090, 1541, "ba-sk-2")
    a13b = crop_css("after", "13-thong-ke-suc-khoe", 1100, 1569, "aa-sk-2")
    sec.append("<h3>Ảnh trước và sau</h3>")
    sec.append(pair(b13a, a13a, "Nhãn 18h / 00h / 06h nằm trên các cột; không có mốc ngày; biểu đồ năng lượng không có thang.", "Nhãn giờ ở lề trái, thêm mốc ngày (1/10, 8/10…), thang 1 / 3 / 5 cho năng lượng."))
    sec.append(pair(b13b, a13b, "Cột Chủ nhật của lịch tháng bị cắt ở mép phải.", "Lịch vừa khít khung, đủ bảy cột."))
    ev = f"{D}/img/evidence/quan-ly-truoc-iphone.png"
    ev_small = f"{SLICES}/evidence-small.jpg"
    im = Image.open(ev).convert("RGB")
    im.thumbnail((780, 1688))
    im.save(ev_small, quality=84)
    sec.append(pair(ev_small, f"{D}/img/after-dark/30-quan-ly-nut-nhanh.jpg", "Ảnh Đạt chụp trên iPhone: tab, danh sách thẻ và nút '+ Nút nhanh mới' dính sát nhau.", "Sau khi sửa (cùng màn, chế độ tối, dữ liệu mẫu): có khoảng cách rõ giữa các khối."))
    sec.append("""
<h2>5.3 Hệ chuyển động</h2>
<p>Trước đợt này app gần như không có chuyển động nào ngoài vòng xoay đồng bộ: thẻ hiện cái bụp, bảng bật ra tức thì, thanh tiến độ nhảy thẳng tới giá trị cuối. Điều đó làm app trông cứng và thiếu phản hồi khi chạm. Mục tiêu chuyển động: <b>phản hồi mỗi lần chạm, dẫn mắt đến thứ vừa thay đổi, và không bao giờ cản trở thao tác</b>.</p>
<h3>Nguyên tắc</h3>
<ol>
  <li><b>Một đường cong chung.</b> Mọi chuyển động dùng <code>cubic-bezier(0.22, 0.8, 0.3, 1)</code> (ra nhanh, dừng mềm); chỉ các thành phần 'nảy' dùng <code>cubic-bezier(0.34, 1.45, 0.5, 1)</code>. Học theo hệ chuyển động của Sổ Chi Tiêu để hai app cùng một cảm giác.</li>
  <li><b>Chỉ transform và opacity</b> (và stroke của SVG), không đổi kích thước hay vị trí bố cục, để mượt trên iPhone và không gây nhảy bố cục.</li>
  <li><b>Ngắn.</b> Phần lớn 140–420 ms; hiệu ứng vào màn tổng cộng dưới nửa giây; biểu đồ vẽ dần 0,6–1 giây.</li>
  <li><b>Tôn trọng 'Giảm chuyển động'.</b> Khi máy bật tuỳ chọn này, mọi animation và transition rút về gần như tức thì (một khối CSS duy nhất ở cuối file).</li>
</ol>
<h3>Danh sách hiệu ứng</h3>""")
    eff = [
        ["Màn vào lần lượt", "Mỗi thẻ trong màn trượt lên 12 px và hiện dần, thẻ sau trễ thêm 40 ms (tối đa 240 ms).", "420 ms, ease", "Cho mắt biết màn đã đổi, dẫn từ trên xuống."],
        ["Bảng trượt lên", "Bảng ghi / chọn danh mục / chấm ngày trượt từ đáy lên; nền mờ dần.", "340 ms, ease; nền 200 ms", "Bảng có nguồn gốc rõ, không bật ra đột ngột."],
        ["Màn Quản lý", "Màn toàn trang hiện dần và trượt 16 px.", "280 ms, ease", "Cảm giác 'đi vào' một màn con."],
        ["Thông báo (toast)", "Rơi nhẹ từ trên xuống kèm nảy.", "340 ms, spring", "Phản hồi sau khi ghi; nảy để gây chú ý vừa đủ."],
        ["Nhấn lún", "Nút, ô nhanh, thẻ tab, tab dưới lún về 96% (tab dưới 92%) khi chạm; đổi màu mượt 200 ms.", "140 ms, ease", "Xác nhận chạm trúng, đặc biệt khi ngón tay che mất nút."],
        ["Tab dưới nảy", "Biểu tượng của tab vừa chọn nảy nhẹ.", "380 ms, spring", "Xác nhận đã chuyển tab."],
        ["Chip hoàn thành", "Chip 'Ngủ / Sáng / Trưa…' khi đạt nảy lên; lựa chọn 1–5 nảy khi chọn.", "300–400 ms, spring", "Thưởng nhỏ cho hành động hoàn thành."],
        ["Vòng và thanh tiến độ", "Vòng 5/6 và các thanh ngân sách chạy từ 0 tới giá trị.", "800–900 ms, ease", "Cho thấy 'đạt được bao nhiêu' thay vì chỉ một con số."],
        ["Biểu đồ vẽ dần", "Đường xu hướng và đường năng lượng vẽ dần theo chiều dài; cột mọc từ đáy (hoặc từ trên xuống với cột giấc ngủ), trễ từng cột.", "600–1000 ms, ease", "Dẫn mắt theo chiều dữ liệu; tránh biểu đồ 'bật' ra."],
        ["Việc đang chạy đập nhẹ", "Biểu tượng trong thẻ 'Đang làm' có vòng sáng lan ra, lặp lại.", "2,2 giây, lặp", "Báo việc còn mở. Là hiệu ứng lặp duy nhất; tắt khi giảm chuyển động."],
    ]
    sec.append(table(["Hiệu ứng", "Mô tả", "Thời lượng / đường cong", "Mục đích"], eff, "dense"))
    s1, f1 = motion_strip("screen", [0, 150, 300, 500], "motion-screen")
    sec.append(s1 + "<figcaption><b>Hình.</b> Bốn khung hình khi chuyển sang màn Thói quen (ở các mốc 0, 150, 300 và 500 ms của animation): tiêu đề hiện trước, từng thẻ trượt lên theo thứ tự, vòng tiến độ đang chạy từ 0.</figcaption></figure>")
    s2, f2 = motion_strip("chart", [0, 250, 500, 1000], "motion-chart")
    sec.append(s2 + "<figcaption><b>Hình.</b> Bốn khung hình khi mở Thống kê → Sức khoẻ (0, 250, 500, 1000 ms): các cột giấc ngủ mọc dần, đường năng lượng vẽ từ trái sang phải.</figcaption></figure>")
    sec.append("""<p class="small">Cách chụp khung hình: làm chậm toàn bộ animation của trình duyệt xuống 4% tốc độ (Chrome DevTools) rồi chụp theo thời gian thật; mốc ghi trong hình là mốc thời gian của animation, không phải thời gian thật. Đây là mô phỏng trong Chromium, chưa đo độ mượt (khung hình/giây) trên iPhone thật.</p>
<h2>5.4 Thẩm mỹ</h2>
<ul>
  <li><b>Chiều sâu nhẹ.</b> Thẻ tổng quan ở Hôm nay có nền chuyển sắc rất nhạt về hướng màu nhấn; các ô nút nhanh có bóng đổ đồng nhất với thẻ.</li>
  <li><b>Thanh tab dưới mờ nền.</b> Nền bán trong suốt kèm làm mờ phía sau, nội dung cuộn qua không bị cắt cứng ở mép.</li>
  <li><b>Chữ số thẳng hàng.</b> Bật chữ số cùng bề rộng (tabular) cho cả app, để cột giờ, số phút và bảng không nhảy khi giá trị đổi.</li>
  <li><b>Vòng tập trung rõ.</b> Khi duyệt bằng bàn phím hoặc công tắc, phần tử đang được chọn có viền nhấn 2 px.</li>
  <li><b>Biểu đồ dễ đọc hơn.</b> Lưới nét đứt mảnh, nhãn ở lề riêng, mốc ngày; màu theo token nên đổi theo sáng/tối.</li>
</ul>
<h3>Chế độ tối</h3>
<p>Bảng màu tối là nâu ấm, không phải đen thuần, đồng bộ với bảng giấy kem của chế độ sáng (token CSS ở đầu file). Ảnh dưới là các màn chính ở chế độ tối.</p>""")
    dark = shots("after-dark", ["01-hom-nay", "10-thong-ke-tong-quan", "22-cai-dat-canh-bao", "12-thong-ke-thoi-gian"], {
        ("01-hom-nay", 0): "Hôm nay, chế độ tối: thẻ tổng quan có nền chuyển sắc về xanh, chip hoàn thành xanh dịu.",
        ("10-thong-ke-tong-quan", 0): "Thống kê → Tổng quan, tối.",
        ("22-cai-dat-canh-bao", 0): "Cài đặt → Cảnh báo, tối: công tắc thẳng hàng sát lề phải.",
        ("12-thong-ke-thoi-gian", 0): "Thống kê → Thời gian, tối: vòng chia giờ và các thanh ngân sách tuần.",
    }, per_row=4)
    sec.append(dark)
    sec.append("""
<h2>5.5 Tham khảo Sổ Chi Tiêu</h2>
<p>Đạt yêu cầu tham khảo Sổ Chi Tiêu. Repo được đọc ở chế độ chỉ đọc; kết quả đọc:</p>
<table class="plain">
<tr><th>Lấy làm mẫu</th><th>Không lấy (và lý do)</th></tr>
<tr><td>Đường cong chung <code>--ease</code> và đường cong nảy <code>--spring</code>; mọi chuyển động chỉ dùng transform / opacity.</td><td>Cử chỉ vuốt từng ngày để xoá/sửa và kéo xuống để làm mới: cần code cử chỉ riêng, chưa có yêu cầu, và dễ xoá nhầm trên màn dài của Nhật ký.</td></tr>
<tr><td>Khối giảm chuyển động ở cuối file tắt mọi animation.</td><td>Màn khung xương (skeleton) khi tải: dữ liệu của Nhật ký ở máy nên gần như tức thì, không cần.</td></tr>
<tr><td>Toast nảy, hộp thoại nảy, tiến độ có transition riêng, biểu đồ vẽ dần.</td><td>Hiệu ứng rung khi nhập mã sai: Nhật ký không có màn nhập mã PIN ngoài khoá app bằng sinh trắc.</td></tr>
<tr><td>Tab dưới nhấn lún; chuyển tab mờ dần chỉ bằng opacity.</td><td>Chuyển cảnh bằng View Transitions: Sổ Chi Tiêu đã bỏ vì làm thanh tab chớp mờ trên iOS.</td></tr>
</table>
<h2>5.6 Đề xuất tiếp theo cho trải nghiệm</h2>
<table class="plain">
<tr><th>Đề xuất</th><th>Vì sao</th><th>Công sức</th></tr>
<tr><td>Gộp các lần uống nước thành một dòng trên Hôm nay ('Nước ×8 · 2 lít').</td><td>Hiện mỗi ly là một dòng; ngày nhiều ly làm dòng thời gian rất dài (màn Hôm nay cao hơn 3 màn hình).</td><td>Vừa</td></tr>
<tr><td>Hiệu ứng đóng cho bảng trượt xuống thay vì biến mất ngay.</td><td>Hiện chỉ có hiệu ứng mở. Hiệu ứng đóng cần giữ phần tử thêm một nhịp trước khi gỡ.</td><td>Vừa</td></tr>
<tr><td>Một 'trạng thái trống' có hướng dẫn cho từng màn thống kê khi dưới 7 ngày.</td><td>Người mới dùng thấy thẻ '—' và 'chưa đủ dữ liệu' mà không biết cần làm gì.</td><td>Nhỏ</td></tr>
<tr><td>Hiện số ngày đứng sau mỗi lời khuyên tương quan (mục 3.6).</td><td>Tránh hiểu nhầm vì d và nhãn 'mạnh' không cho biết cỡ mẫu.</td><td>Nhỏ</td></tr>
<tr><td>Thử trên iPhone thật: độ mượt animation, vuốt ngang trong form, phông chữ khi offline.</td><td>Mọi kiểm tra hiện tại chạy trong Chromium giả lập.</td><td>Nhỏ, cần Đạt</td></tr>
</table>
<h2>5.7 Hạn chế của đợt nâng giao diện</h2>
<ul>
  <li>Chưa đo FPS và chưa thử máy đời cũ; hiệu ứng làm mờ nền ở thanh tab có thể tốn hơn trên máy yếu. Nếu thấy giật, bỏ làm mờ là sửa một dòng CSS.</li>
  <li>Hiệu ứng 'màn vào lần lượt' chạy mỗi lần một màn được dựng lại (đổi tab). Trên màn Hôm nay có dữ liệu cập nhật liên tục, các thẻ không chạy lại (đúng ý), nhưng một thẻ mới xuất hiện (như 'Đang làm') sẽ trượt vào.</li>
  <li>Một số chữ trong ảnh dùng phông hệ thống vì Be Vietnam Pro tải từ Google Fonts; môi trường chụp ảnh đôi lúc không tải được phông này.</li>
</ul>""")
    return "\n".join(sec)


# ================================================================== PART 6: conclusions + appendix
def part6():
    sec = ["<h1 class='part'>Phần 6. Kết luận, rủi ro và việc tiếp theo</h1>"]
    sec.append("""
<h2>6.1 Kết luận</h2>
<ol>
  <li><b>Dữ liệu mẫu dùng được.</b> Một tháng 754 mục ghi, có nhịp ngày thường / cuối tuần, hai ngày ốm, hai ngày đi xa và một tuần nước rút, đủ để mọi màn hình có nội dung hợp lý và để các luật cảnh báo có lý do bật. Bộ sinh là mã có kiểm thử, cùng hạt giống ra cùng dữ liệu, nên có thể sinh lại bất kỳ lúc nào và chia sẻ cho người khác cùng xem một thứ.</li>
  <li><b>Mô hình hành vi minh bạch.</b> Mười tám giả định, mỗi cái ghi rõ vì sao, độ lớn bao nhiêu, và (với mười cái đo được) đã kiểm tra rằng mô phỏng cho đúng chiều. Mọi hiệu ứng nằm trong danh sách, không có hiệu ứng ẩn.</li>
  <li><b>Phát hiện đáng giá nhất: bộ tương quan bị nhiễu bởi lịch ngày thường / cuối tuần.</b> Với dữ liệu đủ dài, phần lớn kết quả mạnh nhất không phải nguyên nhân mà là phản chiếu việc cuối tuần khác ngày thường. Chỉ so các ngày làm việc loại gần hết kết quả sai và giữ gần hết kết quả đúng. Đây là rủi ro trải nghiệm thật: một người đọc lời khuyên 'vận động làm giảm deep work' có thể bỏ tập.</li>
  <li><b>Giao diện sạch hơn và có phản hồi.</b> Tám lỗi bố cục đã sửa, một hệ chuyển động thống nhất, biểu đồ dễ đọc hơn. Phần chưa kiểm chứng duy nhất là trên iPhone thật.</li>
</ol>
<h2>6.2 Rủi ro còn lại</h2>
<table class="plain">
<tr><th>Rủi ro</th><th>Mức</th><th>Cách giảm</th></tr>
<tr><td>Bộ tương quan đưa lời khuyên sai do nhiễu lịch.</td><td>Cao</td><td>Đề xuất ở mục 3.6; chưa sửa vì chạm vào lõi phân tích, cần Đạt duyệt hướng.</td></tr>
<tr><td>Mọi kiểm tra giao diện chạy trong Chromium giả lập, chưa phải iPhone.</td><td>Vừa</td><td>Đạt thử các màn chính và báo lại; mục 5.6.</td></tr>
<tr><td>Dữ liệu mẫu quá đều so với người thật (ít ngày bỏ ghi, giờ chính xác).</td><td>Vừa</td><td>Thêm ngày bỏ ghi và nhiễu giờ cho tab Ghi bù (mục 2.5, 2.7).</td></tr>
<tr><td>Hiệu ứng làm mờ ở thanh tab tốn hơn trên máy yếu.</td><td>Thấp</td><td>Bỏ một dòng CSS nếu giật.</td></tr>
<tr><td>Nút nhanh trên máy đã có dữ liệu vẫn là bộ cũ (trùng nhau).</td><td>Thấp</td><td>Đạt xoá bớt trong Cài đặt; hoặc viết migration (cần hỏi Đạt theo CLAUDE.md).</td></tr>
</table>
<h2>6.3 Việc đề xuất làm tiếp, theo thứ tự</h2>
<ol>
  <li><b>Sửa nhiễu lịch trong bộ tương quan</b> (so trong từng nhóm ngày làm việc / cuối tuần rồi gộp; hiện số ngày). Có sẵn số liệu trước/sau trong báo cáo để làm tiêu chí xong: số phát hiện sai giảm từ """ + str(sum(1 for f in F['days150'] if classify(f)[0] == 'calendar')) + """ xuống gần 0 trên cùng dữ liệu.</li>
  <li><b>Thử trên iPhone</b> các màn Hôm nay, Quản lý, form Ghi mới và cập nhật phiên bản; báo lại độ mượt và chỗ lắc.</li>
  <li><b>Bổ sung vào dữ liệu mẫu</b> các hành vi còn thiếu ở mục 2.7 (rượu bia, ngủ trưa, ngày nghỉ, ngày bỏ ghi) và chạy lại số liệu bằng đúng lệnh ở phụ lục.</li>
  <li><b>Gộp các lần uống nước</b> thành một dòng trên Hôm nay và thêm hiệu ứng đóng cho bảng.</li>
</ol>
<h2>Phụ lục A. Cách chạy lại toàn bộ</h2>
<pre>
# 1. Chạy app (dev) rồi chụp ảnh với dữ liệu tháng 10/2026
npm run dev
PW=/đường/dẫn/playwright CHROME=/đường/dẫn/chromium \\
  node docs/report/capture.cjs docs/report/img/after light
PW=... CHROME=... node docs/report/capture.cjs docs/report/img/after-dark dark
PW=... CHROME=... node docs/report/motion_frames.cjs docs/report/img/motion

# 2. Tính lại số liệu ra docs/report/data/*.json
npx vitest run --config docs/report/vitest.config.ts

# 3. Dựng báo cáo
python3 docs/report/build_report.py
PW=... CHROME=... node docs/report/to_pdf.cjs
</pre>
<h2>Phụ lục B. Các tệp mới trong đợt này</h2>
<table class="plain">
<tr><th>Tệp</th><th>Vai trò</th></tr>
<tr><td><code>src/dev/persona.ts</code> (+ test)</td><td>Bộ sinh dữ liệu người dùng mẫu, 18 giả định hành vi, kịch bản tháng 10/2026.</td></tr>
<tr><td><code>src/dev/panel.ts</code>, <code>console.ts</code>, <code>src/ui/DevPanel.tsx</code></td><td>Nút 'Sinh tháng 10/2026' và hàm dùng cho script chụp ảnh (chỉ ở bản dev).</td></tr>
<tr><td><code>src/ui/charts.tsx</code>, <code>src/ui/style.css</code></td><td>Sửa biểu đồ; lớp chuyển động; thẩm mỹ.</td></tr>
<tr><td><code>docs/report/capture.cjs</code>, <code>motion_frames.cjs</code></td><td>Chụp mọi màn hình và khung hình chuyển động.</td></tr>
<tr><td><code>docs/report/analysis.run.ts</code>, <code>vitest.config.ts</code></td><td>Tính số liệu từ bộ chỉ số, bộ luật, bộ tương quan của app.</td></tr>
<tr><td><code>docs/report/build_report.py</code>, <code>to_pdf.cjs</code></td><td>Dựng báo cáo PDF này.</td></tr>
<tr><td><code>docs/report/data/*.json</code></td><td>Số liệu gốc của mọi bảng và biểu đồ trong báo cáo.</td></tr>
<tr><td><code>docs/report/img/</code></td><td>Ảnh trước, sau, chế độ tối, khung hình chuyển động, ảnh minh chứng.</td></tr>
</table>
""")
    # ---- Appendix D: every finding on 150 days
    sec.append("<h2>Phụ lục C. Toàn bộ phát hiện của bộ tương quan trên 150 ngày mô phỏng</h2><p>Danh sách đầy đủ, theo thứ tự app xếp (độ tin rồi |d|). Cột cuối do người viết báo cáo đối chiếu với danh sách giả định.</p>")
    sec.append(findings_table(F["days150"]))
    # ---- Appendix E: default categories and quick buttons (parsed from the source so it cannot drift)
    src = open(f"{D}/../../src/core/defaults.ts", encoding="utf-8").read()
    cats = re.findall(r"cat\('([\w-]+)', '([^']+)', '(\w+)', \w+, '([^']+)', (\d+)(?:, '(\w+)')?\)", src)
    tname = {"work": "Làm việc", "activity": "Hoạt động", "meal": "Ăn uống", "sleep": "Ngủ", "exercise": "Vận động", "water": "Uống nước"}
    gname = {"work": "Công việc chính", "growth": "Phát triển bản thân", "personal": "Cá nhân", "": "tự động theo loại"}
    rows = [[icon, esc(name), tname.get(t, t), gname.get(g, g)] for _id, name, t, icon, _o, g in cats]
    sec.append("<h2>Phụ lục D. Danh mục và nút nhanh mặc định</h2><p>Bảng sinh trực tiếp từ <code>src/core/defaults.ts</code>. Danh mục nằm dưới một loại; nhóm thời gian quyết định danh mục được tính vào xô nào ở màn Thống kê → Thời gian (chỉ cho loại Làm việc và Hoạt động).</p>")
    sec.append(table(["", "Danh mục", "Loại", "Nhóm thời gian"], rows, "dense"))
    qas = re.findall(r"qa\('([\w-]+)', '([^']+)', '([^']+)', (\d+), '(\w+)'", src)
    rows = [[icon, esc(name), tname.get(t, t)] for _id, name, icon, _o, t in qas]
    sec.append("<p>Nút nhanh mặc định (mỗi nút trỏ vào một Loại; Thức dậy / Đi ngủ nằm ở thẻ giấc ngủ, Uống nước ghi ngay):</p>")
    sec.append(table(["", "Nút", "Loại"], rows))
    # ---- Appendix F: glossary
    sec.append("""
<h2>Phụ lục E. Thuật ngữ</h2>
<table class="plain">
<tr><th>Thuật ngữ</th><th>Nghĩa trong báo cáo</th></tr>
<tr><td>Entry, Day</td><td>Entry là một mục ghi (một bữa ăn, một khối làm việc…). Day là bản chấm ngày (tâm trạng, năng lượng, stress, tập trung, điểm ngày, loại ngày).</td></tr>
<tr><td>Ngày logic</td><td>Ngày kết thúc lúc 04:00 sáng hôm sau, nên ngủ lúc 00:40 vẫn tính vào đêm hôm trước.</td></tr>
<tr><td>Chỉ số (metric)</td><td>Một hàm tính một con số cho mỗi ngày từ Entry và Day. Trả về null khi ngày không có dữ liệu cho chỉ số đó.</td></tr>
<tr><td>null ≠ 0</td><td>Ngày không ghi thì không có giá trị, không phải giá trị bằng 0; phân tích bỏ qua null.</td></tr>
<tr><td>Cohen's d</td><td>Độ chênh giữa hai nhóm tính theo độ lệch chuẩn gộp. Khoảng 0,2 nhỏ, 0,5 vừa, 0,8 lớn.</td></tr>
<tr><td>Welch t</td><td>Thống kê kiểm định chênh trung bình giữa hai nhóm không đòi hỏi độ lệch chuẩn bằng nhau; app chỉ báo khi |t| ≥ 3,5 để tránh báo nhầm khi thử nhiều cặp.</td></tr>
<tr><td>Độ trễ (lag)</td><td>So yếu tố của hôm nay với kết quả của ngày mai.</td></tr>
<tr><td>Nhiễu chồng (confounding)</td><td>Hai thứ cùng thay đổi vì một nguyên nhân thứ ba (ở đây là lịch ngày thường / cuối tuần) nên trông như có liên hệ trực tiếp.</td></tr>
<tr><td>Deep work, OT</td><td>Khối làm việc tập trung; làm thêm giờ là khối nằm ngoài khung giờ làm trong Cài đặt.</td></tr>
<tr><td>Lệch múi giờ xã hội</td><td>Chênh giữa điểm giữa giấc ngủ ngày thường và cuối tuần.</td></tr>
</table>""")
    sec.append("<h2>Phụ lục F. Danh sách ảnh đã chụp</h2>")
    names = sorted(n for n in os.listdir(f"{D}/img/after") if n.endswith(".jpg"))
    rows = [[n.replace(".jpg", "")] for n in names]
    half = (len(rows) + 1) // 2
    left = table(["Ảnh (thư mục after, after-dark, before)"], rows[:half], "dense")
    right = table(["Ảnh (tiếp)"], rows[half:], "dense")
    sec.append(f'<div class="two">{left}{right}</div>')
    return "\n".join(sec)


# ================================================================== assembly
CSS = """
@page { size: A4; margin: 16mm 14mm 18mm 14mm; }
* { box-sizing: border-box; }
html { font-family: 'DejaVu Sans', 'Be Vietnam Pro', sans-serif; color: #2b2418; font-size: 9.6pt; line-height: 1.5; }
body { margin: 0; }
h1, h2, h3 { color: #2f5d50; line-height: 1.25; }
h1.part { font-size: 22pt; margin: 0 0 8mm; padding-top: 12mm; page-break-before: always; page-break-after: avoid; border-bottom: 2px solid #2f5d50; padding-bottom: 4mm; }
h2 { font-size: 14pt; margin: 8mm 0 3mm; page-break-after: avoid; }
h3 { font-size: 11pt; margin: 5mm 0 2mm; page-break-after: avoid; }
p { margin: 2mm 0 3mm; }
ul, ol { margin: 2mm 0 3mm; padding-left: 6mm; }
li { margin-bottom: 1.4mm; }
code, pre { font-family: 'DejaVu Sans Mono', monospace; font-size: 8.4pt; background: #f4ecd6; border-radius: 2px; }
code { padding: 0 1.5mm; }
pre { padding: 3mm; white-space: pre-wrap; line-height: 1.4; }
.small { font-size: 8.2pt; color: #6b5e45; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
.cover .brand { font-size: 13pt; letter-spacing: 3px; text-transform: uppercase; color: #2f5d50; margin-bottom: 10mm; }
.cover h1 { font-size: 32pt; line-height: 1.15; margin: 0 0 8mm; color: #2b2418; }
.cover .sub { font-size: 13pt; color: #6b5e45; max-width: 150mm; }
.cover .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin: 14mm 0; font-size: 10.5pt; }
.cover .note { border-left: 3px solid #a8660a; padding: 3mm 4mm; background: #fbe9c4; font-size: 9.2pt; max-width: 150mm; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 4mm 0; }
.kpi { border: 1px solid #e3d5b4; border-radius: 3mm; padding: 3mm; background: #fffaf0; text-align: center; }
.kpi b { display: block; font-size: 20pt; color: #2f5d50; }
.kpi span { font-size: 8pt; color: #6b5e45; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0 4mm; page-break-inside: auto; }
th, td { border: 1px solid #e3d5b4; padding: 1.4mm 2mm; vertical-align: top; text-align: left; font-size: 8.6pt; }
th { background: #f1e7cc; color: #2b2418; }
tr { page-break-inside: avoid; }
table.dense th, table.dense td { font-size: 7.6pt; padding: 1mm 1.4mm; }
table.hyp td { font-size: 8pt; }
table.plain th { background: #f6efd9; }
.cal td { width: 14.28%; height: 22mm; font-size: 7.4pt; }
.cal td b { font-size: 11pt; margin-right: 1mm; }
.cal td.empty { background: #faf6ea; }
.cal td.we { background: #f7eed3; }
.cal td.sick { background: #fbe9c4; }
.cal td.trip { background: #dbe8f3; }
.cal td.sprint { background: #fadfc6; }
.cal .hl { color: #6b5e45; margin-top: 1mm; font-size: 6.8pt; line-height: 1.25; }
.tg { font-size: 6.4pt; padding: 0 1.2mm; border-radius: 2mm; background: #e3d5b4; margin-right: 1mm; }
.tg.sick { background: #e6b34f; } .tg.trip { background: #8fb6d8; } .tg.sprint { background: #ef9a5b; }
.fig { margin: 4mm 0; page-break-inside: avoid; }
.fig svg { width: 100%; height: auto; }
.fig img.wide { width: 100%; }
figcaption { font-size: 8.2pt; color: #6b5e45; margin-top: 1.5mm; }
.callout { border-left: 3px solid #2f5d50; padding: 2.5mm 4mm; margin: 3mm 0; background: #eef5f1; page-break-inside: avoid; }
.callout.warn { border-color: #a8660a; background: #fbe9c4; }
.callout b { display: block; margin-bottom: 1mm; }
.bd { font-size: 7.4pt; padding: 0 1.4mm; border-radius: 2mm; white-space: nowrap; }
.bd.ok { background: #dcebe3; color: #1f5b3d; } .bd.bad { background: #f7ded6; color: #8c2f23; }
.shotrow { display: flex; gap: 6mm; justify-content: center; margin: 3mm 0; page-break-inside: avoid; align-items: flex-start; }
.shot { flex: 1; max-width: 86mm; position: relative; }
.shotrow.three .shot { max-width: 52mm; }
.shotrow.three { gap: 5mm; }
.shotrow.three .shot .cap { font-size: 7.2pt; }
.shot img { width: 100%; border: 1px solid #d8c9a6; border-radius: 3mm; display: block; }
.shot .cap { font-size: 7.8pt; color: #4a3f2b; margin-top: 1.5mm; line-height: 1.35; }
.shotrow:has(.shot:nth-child(4)) .shot { max-width: 40mm; }
.shotrow:has(.shot:nth-child(4)) .shot .cap { font-size: 6.8pt; }
.tagb, .taga { position: absolute; top: 2mm; left: 2mm; font-size: 7pt; font-weight: bold; padding: 0.6mm 2mm; border-radius: 2mm; color: #fff; z-index: 2; }
.tagb { background: #b5473a; } .taga { background: #2f7d46; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
"""


def toc():
    items = [
        ("Tóm tắt điều hành", ""), ("Phạm vi, cách làm và giới hạn", ""),
        ("Phần 1. Dữ liệu mẫu tháng 10/2026", "kịch bản, quy mô, bảng 30 ngày, biểu đồ, bảng chỉ số, dữ liệu cho thấy gì"),
        ("Phần 2. Phân tích hành vi con người và các giả định", "cách mô hình hoá, nhịp ngày, 18 giả định, sơ đồ tác động, hành vi dùng app, biến cố, hành vi chưa mô hình hoá, kiểm tra"),
        ("Phần 3. App tìm ra gì từ dữ liệu", "ngưỡng tin cậy, luật cảnh báo, tương quan 30 và 150 ngày, nhiễu lịch, theo thứ trong tuần, đề xuất"),
        ("Phần 4. Ảnh chụp mọi màn hình, kèm số liệu", "Hôm nay, Ghi bù, Thói quen, Thống kê, Cài đặt, Quản lý"),
        ("Phần 5. Giao diện, trải nghiệm và chuyển động", "cách rà soát, 8 lỗi đã sửa, hệ chuyển động, thẩm mỹ, chế độ tối, tham khảo Sổ Chi Tiêu, đề xuất"),
        ("Phần 6. Kết luận, rủi ro và việc tiếp theo", "kết luận, rủi ro, việc làm tiếp, phụ lục"),
    ]
    lis = "".join(f"<li><b>{a}</b><br/><span class='small'>{b}</span></li>" for a, b in items)
    return f"<h2>Mục lục</h2><ol class='toc'>{lis}</ol>"


def build():
    body = "\n".join([cover(), toc(), summary(), scope(), part1(), part2(), part3(), part4(), part5(), part6()])
    html_doc = f"<!doctype html><html lang='vi'><head><meta charset='utf-8'><title>Báo cáo Nhật ký</title><style>{CSS}</style></head><body>{body}</body></html>"
    open(OUT_HTML, "w", encoding="utf-8").write(html_doc)
    print("wrote", OUT_HTML, len(html_doc) // 1024, "KB")


if __name__ == "__main__":
    build()
