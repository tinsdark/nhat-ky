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

## Đang dở: T1.1 Khung app (chưa code, chờ Đạt OK hai câu)

Kế hoạch: header có chỉ báo sync, thanh tab dưới (Hôm nay · Thói quen · Thống kê · Cài đặt), điều hướng bằng hash (không thêm router), 4 màn khung trống (Cài đặt có nút Đăng xuất và Đồng bộ ngay), màn đăng nhập lần đầu, mở rộng theme sáng/tối. Kiểm tra bằng test hàm phân tích hash và ảnh chụp Chromium 390×844 sáng/tối. Hai câu chờ trả lời:

1. Màn đăng nhập lần đầu có nút "Dùng ngay, đăng nhập sau" không (đề xuất: có)?
2. Điều hướng bằng hash, không thêm router ngoài: OK không?

## Lưu ý cho T1.2 (dữ liệu mặc định)

Nếu máy thứ hai tự seed danh mục mặc định trước khi kéo từ Drive thì có thể đè danh mục Đạt đã chỉnh, vì `defs` sync cả file theo `updatedAt`. Đề xuất: dữ liệu seed gắn `updatedAt` rất cũ (epoch) và `dirty = 0` để bản thật luôn thắng.

## Tiếp theo theo PLAN

T1.1 → T1.2 (seed: danh mục, 8 nút nhanh, 6 thói quen mẫu bật 3, settings mặc định) → T1.3 màn Hôm nay (task lớn, nên bật Plan mode) → T1.4–T1.9. Cổng P0 và P1 thử trên điện thoại thật.

## Ghi chú

- `Workflow`, `Agent` chỉ dùng khi Đạt yêu cầu rõ.
- Bộ kiểm soát quyền của Claude Code từng chặn commit sửa luật bảo mật trong `CLAUDE.md` cho đến khi Đạt cho phép lệnh Bash trong cài đặt quyền. Nếu bị chặn lại thì dừng và báo, đừng tìm đường lách.
