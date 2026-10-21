# HANDOFF — trạng thái làm việc (21/10/2026)

Ghi lại để phiên chat mới đọc và làm tiếp. Nguồn sự thật vẫn là `CLAUDE.md`, `docs/PLAN.md`, `docs/SPEC.md`; file này chỉ tóm tắt trạng thái và các quyết định đã chốt.

## Bối cảnh

Webapp cá nhân theo dõi đồng hồ sinh hoạt (ngủ, ăn, làm việc, thói quen, năng lượng, tâm trạng), dùng chủ yếu trên điện thoại, không theo dõi tiền. Nhật ký là app riêng, không liên quan Sổ Tiền (đã gỡ hết ở PR #5 và #8). Đừng nhắc Sổ Tiền như mốc so sánh.

## Cách làm việc đã chốt

- Mỗi task: nêu kế hoạch ngắn kèm cách kiểm tra, chờ Đạt OK, rồi mới code.
- Mỗi task một nhánh riêng cắt từ `main` mới (`t<số>-<tên>`), một PR riêng vào `main`, tick `[x]` task trong `docs/PLAN.md` cùng commit, message `T0.x: tên task`.
- Đạt tự merge PR. Không rebase hay ghi đè lịch sử nhánh.
- Xưng tao/mày, trả lời thẳng, nói rõ cái gì chưa kiểm chứng được.

## Đã xong: toàn bộ P0 (PR #1–#10 đã merge)

- **T0.1** khởi tạo: Vite, TS strict, Preact, Vitest, ESLint, Prettier, Dexie, workflow deploy Pages, `.gitattributes` `* text=auto eol=lf`, font Be Vietnam Pro từ Google Fonts, Client ID trong `src/config.ts`.
- **T0.2** `src/core/date.ts`: `toDateKey`, `addDays`, `dateKeyRange`, `weekday` (T2 = 0 … CN = 6), `toIso` (ISO +07:00).
- **T0.3** `src/core/types.ts`, `src/core/settings.ts`, `src/data/db.ts` (Dexie v1), `src/data/repository.ts`. Day có thêm `createdAt`, `deleted`, `dirty`. `dirty` là `0 | 1`. `defs` và `settings` là một dòng mỗi bảng, sync cả file.
- **T0.4** `src/auth/`: GIS token client, scope `drive.appdata`, `getToken` tự xin lại im lặng, `onAuthRequired`. **T0.4b**: token lưu thêm vào localStorage (khoá `nk_tok_v1`) để mở lại trong ~1 giờ không hỏi Google; luật số 3 trong `CLAUDE.md` đã sửa theo.
- **T0.5** `src/drive/client.ts`: API theo tên file trong `appDataFolder`, chỉ ghi/xoá được `nk_`, `nkp_`, `nkt_`, retry 401 một lần, xoá file rỗng khi upload lỗi.
- **T0.6** `src/core/merge.ts` và `src/sync/`: file tháng `nk_YYYY-MM.json`, `nk_defs.json`, `nk_settings.json`; merge từng bản ghi theo `updatedAt`; trigger mở app, tab hiện lại, có mạng, mỗi 60 giây khi tab hiện; trạng thái `idle/syncing/synced/offline/authRequired/error`. Trong dev có `window.nk` để thử từ console.
- **T0.7** PWA: manifest, service worker, icon tạm (đồng hồ trắng nền chàm `#3b4a9e`), font runtime cache.
- Bỏ liên kết Sổ Tiền: PLAN T2.4 và SPEC Module 6 đã bỏ, giữ số thứ tự.

Test hiện có: 107 test pass (`npm run test`), `lint` và `build` pass.

## Chưa kiểm chứng trên thiết bị thật

- Chưa gọi Google/Drive thật: đăng nhập, sync hai trình duyệt, token lưu `localStorage` trên iPhone.
- Chưa cài PWA lên điện thoại, chưa thử font offline.
- Điều kiện trước khi thử: consent screen của OAuth client phải có scope `drive.appdata`; origin `http://localhost:5173` và origin GitHub Pages nằm trong Authorized JavaScript origins; email của Đạt trong Test users; Drive API đã bật.
- iOS: PWA cài vào màn hình chính dùng lưu trữ tách khỏi Safari, lần mở đầu phải đăng nhập lại.

## Đã xong: P1 (T1.1–T1.9), nhánh `claude/eloquent-albattani-7k3kmg`, chưa mở PR

- **T1.1** khung app: tab dưới, hash route, chỉ báo sync, màn đăng nhập có "Dùng ngay, đăng nhập sau" (cờ `nk_skipLogin`).
- **T1.2** seed `src/data/seed.ts` + `src/core/defaults.ts`: stamp epoch, `dirty = 0`. Có 9 nút nhanh (8 của Module 1.1 + "Ra ngoài trời"), lưới đang 3 cột. 3 thói quen bật: nước (tự tính từ `water`), đọc sách, vận động (tự tính từ `exercise`).
- **T1.3** màn Hôm nay: `src/core/timeline.ts` (gap > 2h, tiến độ 6 mục), nút nhanh chạm/giữ, toast Sửa/Hoàn tác, form, FAB.
- **T1.4** timer = Entry `work` mở (`source = timer`, `end = null`), `src/data/timer.ts`. `isOvertime`: khối không nằm trọn trong giờ làm của ngày làm việc (qua nửa đêm luôn là OT).
- **T1.5** form đầy đủ: payload theo loại (`src/ui/PayloadFields.tsx`), gợi ý title, nút −15p/−30p/−1h, cảnh báo trùng giờ.
- **T1.6** giấc ngủ: Đi ngủ mở Entry, Thức dậy đóng + hỏi chất lượng, hỏi bù khi quên (gợi ý TB 7 ngày). Ngủ trưa `payload.nap`.
- **T1.7** chấm ngày: `src/core/review.ts`, banner sau `settings.reviewTime` (21:30), hôm sau hỏi lại một lần (cờ `nk_reviewAsked_<dateKey>`). Thêm Settings `reviewTime`, `skipRestDays`; `getSettings` điền mặc định cho trường thiếu.
- **T1.8** thói quen: `src/core/habits.ts` (đạt ngày, streak ngày/tuần, tỷ lệ, heatmap), tick = Entry `habit` + `payload.habitId`. Thói quen liên kết (nước, vận động) không có nút tick.
- **T1.9** chi tiết khối: Sửa / Nhân bản / Xoá (Hoàn tác = `restoreEntry`) / Chép sang hôm nay (khi xem ngày khác).

Test: 182 pass, lint và build pass. Đã chạy từng task trong Chromium 390×844 (Playwright), chưa thử trên điện thoại thật.

Chưa làm / cần để ý:
- Màn Cài đặt đã sửa được giờ làm, mục tiêu, nhắc nhở, ngưỡng cảnh báo; chưa sửa được danh mục và nút nhanh.
- Entry ăn uống không chọn danh mục thì không tính vào "x/6 mục cốt lõi" (đếm theo `categoryId` Ăn sáng/trưa/tối).
- Cổng P1: thử trên điện thoại thật.

## Đã xong: P2 (T2.1, T2.2, T2.3, T2.5), cùng nhánh, chưa mở PR

- **T2.1** `src/core/metrics/`: registry 29 chỉ số + `habit:<id>` + `habit_rate`. Một giấc ngủ thuộc ngày bắt đầu (`nightSleep(dateKey)`), nên "giờ dậy" của ngày D là sáng D+1. Ngày không ghi gì → `null`. Test trên 7 ngày mẫu tính tay.
- **T2.2** màn Thống kê: thẻ tuần vs tuần trước, xu hướng 90 ngày (2 chỉ số, TB trượt 7 ngày), lịch tháng, theo thứ trong tuần. SVG tự vẽ (`src/ui/charts.tsx`). Phần "tương quan" (Module 7.1 mục 5) chờ T3.2.
- **T2.3** ảnh: `src/core/photo.ts` (đọc EXIF `DateTimeOriginal` tự viết, không thêm thư viện), `src/photos/` (nén canvas WebP, hàng đợi tải lên riêng, cache ≤ 200 MB, dọn ảnh mồ côi sau 1 ngày). Thử thật: JPEG 5,8 MB có GPS → 138 KB, thumb 9 KB, không còn EXIF/GPS, giờ ăn lấy theo giờ chụp (`payload.timeSource = photo`). Safari không mã hoá được WebP sẽ rơi về JPEG (tên file vẫn `.webp`).
- **T2.5** `src/core/rules/`: 11 luật, `evaluateRules` có cổng < 7 ngày và cooldown. Ngưỡng sửa ở màn Cài đặt (`Settings.ruleThresholds`, khoá `<ruleId>.<param>`). Thẻ lời khuyên trên Thống kê đang hiện tối đa 3 luật, chưa lưu `lastShown` (T3.3).

Xoá Entry không xoá ảnh ngay: ảnh bị dọn sau 24 giờ nếu không còn Entry nào dùng, để "Hoàn tác" vẫn còn ảnh.

Test: 249 pass, lint và build pass. Chưa chạy trên điện thoại thật: camera/HEIC, tải ảnh lên Drive thật, `navigator.connection`.

## Đã xong: P3 trừ T3.7 (T3.1–T3.6), cùng nhánh, chưa mở PR

- **T3.1** `src/dev/fakeData.ts` (thuần, có seed) + `src/dev/panel.ts` + `src/ui/DevPanel.tsx` (chỉ có ở `npm run dev`, bản build không chứa). "Xoá dữ liệu test" xoá mềm và xoá sạch nội dung (`deviceId = fake-data`) để việc xoá cũng lên Drive nếu file tháng đã được tải.
- **T3.2** `src/core/correlation/`: Cohen's d + Welch t, nhóm nhị phân / 1/3, hai nửa cùng chiều, loại ngày sick/travel/holiday, lag 1 chỉ bật từ 60 ngày. Thêm hai thứ SPEC không có: ngưỡng |t| ≥ 3,5 (chống báo nhầm khi so hàng trăm cặp) và gộp các yếu tố đi cùng nhau (|r| ≥ 0,7) thành một kết quả. Trên 8 seed 60 ngày: tìm đúng 2 quy luật cài sẵn, tối đa 2 kết quả giả.
- **T3.3** `src/core/insights.ts` + `src/data/insights.ts`: mẫu câu có số + hành động, xếp hạng, tối đa 3/ngày, Thử / Hữu ích / Không đúng / Ẩn 2 tuần, chạy 1 lần/ngày. Dexie lên v2 (thêm bảng `insights`), sync file `nk_insights.json`.
- **T3.4** `src/core/experiments.ts` + `src/data/experiments.ts`: "Thử 14 ngày" tạo thói quen tạm "Thử: …"; hết hạn thì so ngày làm đúng với 14 ngày trước đó, hỏi Giữ / Bỏ. Chỉ lời khuyên từ tương quan có hành động mới thử được.
- **T3.5** `src/backup/`, `src/core/backup.ts`: snapshot `nk_backup_YYYY-MM-DD.json` mỗi Chủ nhật (giữ 8, chạy khi mở app và đã đăng nhập), xuất JSON, xuất CSV theo khoảng ngày và loại, nhập JSON (chỉ lấy bản mới hơn). Chưa có nhập CSV (SPEC ghi "nếu có dữ liệu cũ").
- **T3.6** `src/core/claudePrompt.ts` + `src/ui/AskClaude.tsx`: prompt chỉ gồm số trung bình 7/30 ngày và các nhận xét của app (test bảo đảm không lọt ghi chú, tiêu đề, ảnh), chép clipboard + mở `claude.ai/new`, ô dán ngược lưu trong `nk_insights.json`.

Test: 303 pass, lint và build pass.

## Còn lại: T3.7 nghiệm thu (cần điện thoại thật và Google thật)

Đã kiểm trên máy dev (đã tick trong PLAN): ngày logic qua nửa đêm, streak, ảnh < 300 KB, engine tương quan, dashboard ~0,25 giây với 8.186 Entry.
Chưa kiểm: ghi offline rồi sync hai máy, hai máy sửa cùng Entry, token hết hạn giữa chừng, cài PWA và mở offline, ảnh iPhone/HEIC, xoá dữ liệu giả trên Drive, deploy bản 1/11. Điều kiện trước khi thử Drive: xem mục "Chưa kiểm chứng trên thiết bị thật" ở trên.

## Ghi chú

- `Workflow`, `Agent` chỉ dùng khi Đạt yêu cầu rõ.
- Bộ kiểm soát quyền của Claude Code từng chặn commit sửa luật bảo mật trong `CLAUDE.md` cho đến khi Đạt cho phép lệnh Bash trong cài đặt quyền. Nếu bị chặn lại thì dừng và báo, đừng tìm đường lách.
