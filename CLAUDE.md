# CLAUDE.md — Nhật ký

Webapp cá nhân theo dõi **đồng hồ sinh hoạt** (ngủ, ăn, làm việc, thói quen, năng lượng, tâm trạng) để đưa lời khuyên về sức khoẻ, công việc, tinh thần. Một người dùng (Đạt), dùng chủ yếu trên điện thoại. **Không theo dõi tiền.**

## Tài liệu

- `docs/SPEC.md` — đặc tả đầy đủ (data model, 10 module, tiêu chí xong). Đây là nguồn sự thật. Mâu thuẫn giữa code và SPEC → hỏi, không tự chọn.
- `docs/PLAN.md` — danh sách task theo phase. Làm xong task nào thì tick `[x]` task đó trong PLAN.md cùng commit.
- Khi đọc SPEC, mục "Module N" tương ứng task cùng tên trong PLAN.

## Stack & lệnh

- Vite + TypeScript (strict) + Preact, Dexie (IndexedDB), vite-plugin-pwa, Vitest.
- Font Be Vietnam Pro, theme sáng/tối theo máy. Biểu đồ: SVG tự vẽ, không thêm thư viện chart trừ khi hỏi trước.
- Deploy: GitHub Pages qua GitHub Actions, `base: '/nhat-ky/'`.

```
npm run dev        # http://localhost:5173
npm run test       # vitest
npm run build
npm run lint
```

Không thêm dependency mới ngoài danh sách trên mà không hỏi Đạt.

## Kiến trúc — luật cứng

1. **Local-first.** UI chỉ đọc/ghi IndexedDB qua lớp `src/data/`. Không component nào gọi Drive trực tiếp.
2. **Sync engine** (`src/sync/`) đẩy/kéo IndexedDB ↔ Google Drive `appDataFolder`. Merge từng bản ghi theo `updatedAt`; xoá là xoá mềm (`deleted: true`).
3. **Đăng nhập**: Google Identity Services token client, scope duy nhất `https://www.googleapis.com/auth/drive.appdata`. Token giữ trong bộ nhớ và lưu kèm giờ hết hạn vào localStorage (khoá `nk_tok_v1`, sống ≤ 1 giờ, scope chỉ `drive.appdata`) để mở lại app trong ~1 giờ vào thẳng, như Sổ Tiền; đăng xuất thì xoá. Lỗi 401 → xin token im lặng (`prompt: ''`), thất bại mới hiện nút "Đăng nhập lại". Dữ liệu vẫn ghi local trong lúc chờ.
4. **Client ID dùng lại cái đang có** (cùng project Google với Sổ Tiền cho tiện; hai app không đọc, không ghi dữ liệu của nhau). Client ID để trong `src/config.ts` — public, không phải secret. Không có secret nào trong repo.
5. **File trên Drive**: mọi file của Nhật ký có tiền tố `nk_` (`nkp_`/`nkt_` cho ảnh). Không đụng file của app khác.
6. **Không tiền**: app không theo dõi và không lưu số tiền dưới bất kỳ hình thức nào.
7. **Ngày logic**: một ngày kết thúc lúc `dayStartHour` (mặc định 04:00) sáng hôm sau. Mọi Entry có `dateKey` tính bằng **một hàm duy nhất** `toDateKey(ts, dayStartHour)` trong `src/core/date.ts`. Không tự cắt ngày ở chỗ khác. Múi giờ: Asia/Ho_Chi_Minh (UTC+7). Lưu thời gian dạng ISO có offset.
8. **Không lưu số liệu dẫn xuất.** Tổng, trung bình, streak, chỉ số đều tính lại từ Entry + Day qua metric registry (`src/core/metrics/`).
9. **`null` ≠ 0.** Ngày không ghi → metric trả `null`; phân tích bỏ qua `null`.
10. Mỗi bản ghi: `id` (UUID), `createdAt`, `updatedAt`, `deviceId`, `deleted`.

## Cấu trúc thư mục

```
src/
  config.ts            # clientId, hằng số
  core/                # logic thuần, KHÔNG import Preact/Dexie/fetch — test bằng Vitest
    date.ts            # toDateKey, khoảng ngày
    types.ts           # Entry, Day, Defs, Settings, Insight
    habits.ts          # đạt ngày, streak, tỷ lệ
    metrics/           # registry: (dateKey, ctx) => number | null
    rules/             # luật cảnh báo
    correlation/       # engine tương quan
  data/                # Dexie schema + repository
  auth/                # GIS token client
  drive/               # Drive REST client (appDataFolder)
  sync/                # sync engine
  photos/              # nén ảnh, hàng đợi tải
  ui/                  # screens + components (Preact)
  dev/                 # sinh dữ liệu giả — chỉ chạy ở dev
```

## Quy ước code

- Logic nghiệp vụ đặt trong `src/core/` dạng hàm thuần, có test Vitest. Mọi task có logic tính toán phải kèm test.
- Chữ trên UI bằng tiếng Việt. Tên biến, hàm, comment code bằng tiếng Anh.
- Mobile-first: thiết kế cho màn 360–430px trước. Nút chạm tối thiểu 44px.
- Mục tiêu tốc độ: ghi một sự kiện ≤ 2 chạm từ màn Hôm nay.

## Cách làm việc

### 1. Nghĩ trước khi code
- Nói rõ giả định. Không chắc thì hỏi.
- Có nhiều cách hiểu thì liệt kê ra, không tự chọn im lặng.
- Có cách đơn giản hơn thì nói. Phản biện khi cần.
- Chỗ nào không rõ thì dừng lại, gọi tên chỗ đó, hỏi.

### 2. Đơn giản trước
- Code tối thiểu để giải quyết đúng yêu cầu. Không tính năng ngoài task.
- Không abstraction cho code dùng một lần. Không "cấu hình linh hoạt" không ai yêu cầu.
- Không xử lý lỗi cho tình huống không thể xảy ra.

### 3. Sửa có chủ đích
- Chỉ đụng vào chỗ task cần. Không "cải thiện" code, comment, format bên cạnh.
- Giữ style có sẵn. Thấy dead code không liên quan thì báo, không xoá.
- Xoá import/biến/hàm mà chính thay đổi của mình làm thừa.
- Mỗi dòng thay đổi phải truy được về task.

### 4. Làm theo mục tiêu kiểm chứng được
- Mỗi task có tiêu chí xong trong PLAN.md. Viết test tái hiện trước, rồi làm cho pass.
- Task nhiều bước: nêu kế hoạch ngắn dạng `bước → cách kiểm tra` trước khi code.
- Báo cáo cuối task: đã làm gì, test nào chạy, còn gì chưa làm. Chỉ rõ file đã sửa.

## Phải hỏi Đạt, không được đoán

- Bất kỳ thay đổi nào với schema dữ liệu đã có dữ liệu thật (sau 1/11): phải có migration và hỏi trước.
- Thêm dependency, thêm scope OAuth, đổi cấu trúc file trên Drive.
