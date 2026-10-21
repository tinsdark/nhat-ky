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
- Chưa có UI sửa Settings (đổi giờ chấm ngày, `skipRestDays`) và sửa danh mục/nút nhanh.
- Entry ăn uống không chọn danh mục thì không tính vào "x/6 mục cốt lõi" (đếm theo `categoryId` Ăn sáng/trưa/tối).
- Cổng P1: thử trên điện thoại thật.

## Tiếp theo theo PLAN

P2: T2.1 metric registry → T2.2 dashboard → T2.3 ảnh → T2.5 luật cảnh báo.

## Ghi chú

- `Workflow`, `Agent` chỉ dùng khi Đạt yêu cầu rõ.
- Bộ kiểm soát quyền của Claude Code từng chặn commit sửa luật bảo mật trong `CLAUDE.md` cho đến khi Đạt cho phép lệnh Bash trong cài đặt quyền. Nếu bị chặn lại thì dừng và báo, đừng tìm đường lách.
