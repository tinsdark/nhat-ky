# PLAN — Nhật ký

Mốc: **21–31/10 build + test bằng dữ liệu giả, 1/11 nhập dữ liệu thật.**
Thứ tự ưu tiên nếu trễ: P0–P1 (ghi chép) bắt buộc xong 31/10. P2–P3 được phép lùi sang đầu tháng 11.

Đọc `CLAUDE.md` và mục tương ứng trong `docs/SPEC.md` trước mỗi task. Xong task thì tick `[x]` và commit, mỗi task một commit: `T1.3: màn Hôm nay`.

---

## Việc Đạt làm trước khi giao cho Claude Code

- [ ] Tạo repo GitHub `nhat-ky`, clone về máy.
- [ ] Xuất doc plan ra Markdown, lưu thành `docs/SPEC.md`. Copy `CLAUDE.md` vào gốc repo, file này vào `docs/PLAN.md`.
- [ ] Google Cloud Console, project chứa OAuth client đang dùng:
    - [ ] OAuth client → Authorized JavaScript origins: thêm `http://localhost:5173` (origin `https://<user>.github.io` chắc đã có sẵn).
    - [ ] Drive API đã bật.
    - [ ] OAuth consent screen: chế độ Testing, email của mày nằm trong Test users. Kiểm tra scope `drive.appdata` có trong danh sách.
    - [ ] Copy Client ID để đưa cho Claude Code ở T0.4.
- [ ] Repo `nhat-ky` → Settings → Pages → Source: GitHub Actions.

## Cách giao việc cho Claude Code

- Mỗi phase một session. Đầu session gõ:
  > Đọc CLAUDE.md, docs/PLAN.md và các mục SPEC liên quan tới phase Px. Làm lần lượt từng task chưa tick của phase Px. Trước mỗi task nêu kế hoạch ngắn + cách kiểm tra, chờ tao OK rồi mới code.
- Task lớn (T0.6, T1.3, T3.2): bật Plan mode trước.
- Hết mỗi phase: tự chạy checklist "Cổng" của phase đó trên điện thoại thật.

---

## P0 — Nền móng (21–22/10)

- [x] **T0.1 Khởi tạo dự án.** Vite + TS strict + Preact, ESLint + Prettier, Vitest, vite-plugin-pwa, `base: '/nhat-ky/'`. Workflow GitHub Actions build + deploy Pages khi push `main`. Tạo cấu trúc thư mục như CLAUDE.md.
    - Xong khi: `npm run test`, `npm run build` chạy; push lên thấy trang trống trên `https://<user>.github.io/nhat-ky/`.
- [x] **T0.2 Ngày logic** (`src/core/date.ts`). `toDateKey(ts, dayStartHour = 4)`, `dateKeyRange(from, to)`, `addDays(dateKey, n)`, thứ trong tuần của dateKey.
    - Xong khi: test pass với đủ các dòng trong bảng "Ngày logic" của SPEC (00:40 T3 → T2; 04:00 T3 → T3; 03:59 → ngày trước) + đổi `dayStartHour` = 5.
- [x] **T0.3 Types + IndexedDB** (`src/core/types.ts`, `src/data/`). Type Entry, Day, Defs (categories, habits, quickActions, tags), Settings, Insight đúng bảng SPEC. Dexie: bảng `entries` (index `dateKey`, `type`, `[type+dateKey]`, `dirty`), `days`, `defs`, `settings`, `photos`, `meta`. Repository: create/update/softDelete/getByDateKey/getRange; mọi lần ghi set `updatedAt`, `deviceId`, `dirty = 1`. `deviceId` sinh 1 lần, lưu trong `meta`.
    - Xong khi: test repository với fake-indexeddb (dev dependency được phép thêm).
- [x] **T0.4 Đăng nhập** (`src/auth/`). GIS token client, scope `drive.appdata`, Client ID trong `src/config.ts` (hỏi Đạt). Token giữ trong bộ nhớ + thời điểm hết hạn, lưu cả vào localStorage để mở lại trong ~1 giờ không phải hỏi Google (đổi 21/10). API: `getToken()` tự xin lại im lặng khi gần hết hạn; `onAuthRequired` để UI hiện nút đăng nhập lại.
    - Xong khi: đăng nhập được trên localhost và trên Pages; reload xong vào lại không bị hỏi chọn tài khoản nếu Google còn phiên.
- [x] **T0.5 Drive client** (`src/drive/`). Trong `appDataFolder`: list theo tên (prefix `nk_`), đọc JSON, tạo/cập nhật JSON (multipart), tải lên/tải về blob (cho ảnh), xoá file, lấy `modifiedTime`. Tự retry 1 lần khi 401 qua `getToken()`. Không có hàm nào ghi file không có tiền tố `nk_`/`nkp_`/`nkt_` (chặn bằng assert).
- [x] **T0.6 Sync engine** (`src/sync/`). File theo tháng `nk_YYYY-MM.json` chứa `{ entries, days }`; thêm `nk_defs.json`, `nk_settings.json`. Thuật toán: đọc file remote (bỏ qua nếu `modifiedTime` không đổi so với lần trước) → merge từng bản ghi theo `updatedAt` (hàm thuần trong `src/core`, có test) → ghi local → ghi lại remote nếu có bản ghi `dirty` → xoá cờ `dirty`. Trigger: mở app, `visibilitychange` sang visible, `online`, mỗi 60s khi có dirty. Trạng thái sync hiện ở UI (đã sync / đang sync / offline / cần đăng nhập).
    - Xong khi: test merge (bản mới thắng, xoá mềm thắng nếu mới hơn, không nhân đôi); 2 trình duyệt cùng tài khoản thấy dữ liệu của nhau ≤ 2 phút.
- [x] **T0.7 PWA.** Manifest (tên "Nhật ký", icon, `display: standalone`, theme color), service worker cache app shell. Mở offline được sau lần đầu.

**Cổng P0:** cài PWA lên điện thoại, tạo 1 bản ghi test offline → bật mạng → PC thấy.

## P1 — Ghi chép (23–26/10) — SPEC Module 1, 2, 3, 4, 5

- [x] **T1.1 Khung app.** Thanh tab dưới: Hôm nay · Thói quen · Thống kê · Cài đặt. Chỉ báo sync ở header. Màn đăng nhập lần đầu.
- [x] **T1.2 Dữ liệu mặc định.** Seed lần đầu: danh mục (Module 4.1 + loại ăn uống), 8 nút nhanh (Module 1.1 + "Ra ngoài trời"), 6 thói quen mẫu (bật 3, Module 2.4), settings mặc định (`dayStartHour` 4, giờ làm 8:00–17:30 T2–T6, mục tiêu ngủ 7,5h, nước 2000ml, vận động 150 phút/tuần).
- [x] **T1.3 Màn Hôm nay** (Module 1.1, 1.2). Đổi ngày ◀ ▶, thanh "đã ghi x/y mục cốt lõi", lưới nút nhanh (chạm = tạo Entry + toast 5s có Sửa/Hoàn tác; giữ = mở form điền sẵn), timeline dọc theo giờ, khoảng trống > 2h hiện vạch "chưa ghi" chạm để điền, nút + nổi.
    - Xong khi: ghi "Ăn trưa" ≤ 2 chạm; Entry 23:00–01:00 hiện đúng trên timeline ngày logic.
- [x] **T1.4 Timer** (Module 1.2, 4). Một timer chạy tại một thời điểm, lưu trạng thái trong IndexedDB (reload/đóng app không mất). Bật timer mới tự dừng timer cũ. Dừng → hỏi focus 1–5 (bỏ qua được). Nút +1 bị ngắt. Tự set `isOvertime` theo giờ làm chuẩn.
- [x] **T1.5 Form đầy đủ** (Module 1.3). Trường chung + payload theo loại: sleep, meal (Module 3.2, chưa có ảnh), work/activity (4.2), exercise (5.2), water, check-in năng lượng/tâm trạng (5.3). Gợi ý title theo tần suất từ lịch sử. Nút giờ −15p/−30p/−1h. Validate `end > start`, cảnh báo trùng giờ.
- [x] **T1.6 Giấc ngủ** (Module 5.1). "Đi ngủ" tạo Entry mở; "Thức dậy" đóng Entry đang mở + hỏi chất lượng. Sáng hôm sau không có giấc ngủ đêm qua → hỏi giờ ngủ, gợi ý = TB 7 ngày. Ngủ trưa `payload.nap`.
- [x] **T1.7 Chấm cuối ngày** (Module 1.4). Màn chấm Day: 4 thanh 1–5, điểm ngày 1–10, highlight, loại ngày, thói quen chưa tick. Banner trong app sau 21:30; sáng hôm sau hỏi lại một lần.
- [x] **T1.8 Thói quen** (Module 2). CRUD định nghĩa, tick/+1, `linkedRule` cho nước uống. `src/core/habits.ts`: đạt ngày, streak (ngày không có lịch không đứt; lịch x lần/tuần tính theo tuần; tuỳ chọn bỏ qua ngày sick/travel), tỷ lệ 7/30/90 ngày. Heatmap 12 tuần.
    - Xong khi: test streak với lịch T2–T6, "3 lần/tuần", thói quen `quit`.
- [x] **T1.9 Sửa/xoá** (Module 1.5). Chạm khối → chi tiết → Sửa / Nhân bản / Xoá (mềm, có Hoàn tác). Chép khối từ hôm qua.

**Cổng P1:** dùng thử 1 ngày trọn vẹn trên điện thoại: ngủ, 3 bữa, 2 khối làm việc, tick thói quen, chấm ngày — không cần mở PC.

## P2 — Thống kê, ảnh, luật (27–28/10) — SPEC Module 7, 10, 8.2

- [x] **T2.1 Metric registry** (Module 7.2, 5.5, 3.4, 4.5). Mỗi chỉ số: `id`, nhãn, đơn vị, `compute(dateKey, ctx) → number | null`. Gồm cả chỉ số đồng hồ sinh hoạt: điểm giữa giấc ngủ, lệch ngày thường/cuối tuần, độ đều giờ ngủ, khung ăn, bữa cuối → ngủ, cà phê cuối → ngủ.
    - Xong khi: test từng chỉ số trên 7 ngày mẫu tính tay; ngày thiếu dữ liệu trả `null`.
- [x] **T2.2 Dashboard** (Module 7.1). Thẻ tuần (so 7 ngày trước), xu hướng 90 ngày + TB trượt 7 ngày, lịch tháng tô màu, theo thứ trong tuần. Chỗ cho thẻ lời khuyên (điền ở T3.3).
- [x] **T2.3 Ảnh** (Module 10). Chọn/chụp ảnh → đọc giờ chụp (EXIF DateTimeOriginal; iPhone có thể là HEIC — nếu trình duyệt không vẽ được HEIC lên canvas thì báo lỗi rõ ràng) → canvas → WebP 0,7, cạnh dài 1280px + thumb 320px → lưu IndexedDB → hàng đợi tải lên Drive `nkp_/nkt_` (tuỳ chọn chỉ Wi-Fi). Tối đa 3 ảnh/Entry. Giờ chụp gợi ý giờ ăn (`timeSource = photo`). Xoá Entry → xoá ảnh. Cache ảnh lớn ≤ 200 MB.
    - Xong khi: ảnh lưu < 300 KB, không còn GPS; sync dữ liệu không chờ ảnh.
- [x] ~~**T2.4**~~ — bỏ (21/10). Giữ số thứ tự để T2.5 không đổi tên.
- [ ] **T2.5 Luật cảnh báo** (Module 8.2). Định nghĩa luật dạng dữ liệu (điều kiện trên metric, cửa sổ ngày, ưu tiên, mẫu câu, thời gian chờ). Đủ 11 luật mặc định. Ngưỡng sửa trong Cài đặt.

## P3 — Phân tích (29–31/10) — SPEC Module 8, 9

- [ ] **T3.1 Sinh dữ liệu giả** (`src/dev/`). Script sinh 60 ngày có quy luật cài sẵn: ngủ trước 23h30 → năng lượng hôm sau +1; cà phê sau 15h → chất lượng ngủ −1; còn lại ngẫu nhiên. Chỉ chạy khi `import.meta.env.DEV`; có nút "Xoá dữ liệu test".
- [ ] **T3.2 Engine tương quan** (Module 8.1, 8.3). Kết quả Y × yếu tố X, cùng ngày + trễ 1 ngày, chia nhóm (nhị phân / 1/3 thấp–cao), Cohen's d, lọc: mỗi nhóm ≥ 7 ngày, |d| ≥ 0,5, hai nửa thời gian cùng chiều, loại ngày sick/travel/holiday. Mức tin cậy Yếu/Vừa/Mạnh. Tự bật theo số ngày có dữ liệu (bảng 8.1).
    - Xong khi: trên dữ liệu T3.1 tìm ra đúng 2 quy luật cài sẵn và báo ≤ 2 quy luật giả.
- [ ] **T3.3 Lời khuyên** (Module 8.4). Insight → mẫu câu có số + hành động. Xếp hạng, tối đa 3/ngày, nút Thử / Hữu ích / Không đúng / Ẩn 2 tuần. Lưu `nk_insights.json`. Hiện trên Dashboard.
- [ ] **T3.4 Thí nghiệm** (Module 8.5). Tạo từ lời khuyên, thói quen tạm 14 ngày, so sánh trước/sau khi hết hạn.
- [ ] **T3.5 Backup & xuất** (Module 9.3). Snapshot `nk_backup_YYYY-MM-DD.json` mỗi Chủ nhật, giữ 8 bản. Xuất JSON đầy đủ + CSV theo loại. Nhập từ JSON.
- [ ] **T3.6 Nút "Hỏi Claude"** (Module 8.6, cách A). Dựng prompt từ bảng chỉ số 7/30 ngày + insight, không có ghi chú tự do và ảnh. Copy vào clipboard + mở app Claude. Ô dán ngược kết quả để lưu.
- [ ] **T3.7 Nghiệm thu.** Chạy hết checklist dưới đây trên điện thoại thật, sửa lỗi, xoá dữ liệu giả, deploy bản 1/11.

## Checklist nghiệm thu (trước 1/11)

- [ ] Entry qua nửa đêm gán đúng ngày logic (ngủ 01:30, làm việc 23:00–01:00).
- [ ] Ghi offline trên điện thoại, bật mạng, PC thấy trong ≤ 2 phút.
- [ ] Hai máy cùng sửa một Entry → bản mới hơn thắng, không nhân đôi.
- [ ] Token hết hạn giữa chừng → không mất dữ liệu, tự sync lại sau khi đăng nhập.
- [ ] Cài PWA lên màn hình chính, mở offline được.
- [ ] Streak đúng với lịch T2–T6 và "3 lần/tuần".
- [ ] Ảnh < 300 KB, giờ Entry = giờ chụp, không có GPS.
- [ ] Engine tương quan qua bộ dữ liệu giả 60 ngày.
- [ ] Dashboard < 1 giây với 1 năm dữ liệu giả (~11.000 Entry).
- [ ] Đã xoá sạch dữ liệu giả, kể cả trên Drive.

## Sau 1/11 (P4)

- [ ] Push nhắc nhở (phương án C: Cloudflare Workers + cron).
- [ ] Gọi Claude API trực tiếp (cách B) — tuỳ gói Claude của Đạt.
- [ ] Nhập bằng câu tự nhiên.
