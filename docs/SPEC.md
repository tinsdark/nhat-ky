# Plan webapp Nhật ký Lịch trình

Oct 21, 2026 · @Tien Dat

## Tổng quan

App tên **Nhật ký** — webapp cá nhân theo dõi **đồng hồ sinh hoạt**: giờ ngủ, giờ ăn, giờ làm, thói quen, năng lượng và tâm trạng trong ngày; từ đó tìm quy luật và đưa lời khuyên cho **sức khoẻ, công việc, tinh thần**. Không theo dõi tiền. Dùng chủ yếu trên điện thoại.

Dữ liệu nằm trong Drive của chính mày, không phụ thuộc app nào khác.

**Mục tiêu đo được**

- Ghi một sự kiện mất ≤ 5 giây (2 chạm) trên điện thoại.
- Cuối ngày review và chấm điểm ngày mất ≤ 60 giây.
- Sau 4 tuần dữ liệu: app chỉ ra ít nhất 3 quy luật có số liệu đi kèm (vd "ngủ trước 23h30 → điểm năng suất hôm sau cao hơn 1,2 điểm").
- Mở được offline, tự sync khi có mạng, dùng chung trên điện thoại và PC.

**Ngoài phạm vi V1**

- Không theo dõi, không phân tích tiền.
- Không nhiều người dùng, không chia sẻ, không mạng xã hội.
- Không tích hợp đồng hồ/thiết bị đeo, Google Fit, Apple Health.
- Không gọi AI ở bản đầu (để giai đoạn sau, xem 8.6).
- Không tính calo chi tiết theo cơ sở dữ liệu dinh dưỡng.

**Nguyên tắc thiết kế** (rút ra từ các app cùng loại như Exist, Bearable)

1. **Nhập phải nhanh hơn lười.** Lý do số 1 người ta bỏ app tracking là mệt vì phải ghi. Mọi thứ ưu tiên nút bấm sẵn, giá trị mặc định, sao chép từ hôm qua.
2. **Bắt đầu ít chỉ số.** Bật sẵn 5–7 thứ cốt lõi, còn lại tự thêm dần. Theo dõi 30 thứ ngay tuần đầu là bỏ cuộc.
3. **Một nguồn sự thật.** Mọi thứ đều là một bản ghi có thời điểm. Tổng, trung bình, streak luôn tính lại, không lưu.
4. **Lời khuyên phải có số và có độ tin cậy.** Không phán chung chung. Thiếu dữ liệu thì nói "chưa đủ dữ liệu", không bịa.
5. **Tương quan không phải nhân quả.** App chỉ ra cái đi kèm nhau; mày tự quyết thử thay đổi gì. App hỗ trợ "thí nghiệm" để kiểm chứng.
6. **Dữ liệu là của mày.** Nằm trên Drive của mày, xuất ra JSON/CSV bất cứ lúc nào.

## Kiến trúc & tech stack

Local-first: UI chỉ đọc/ghi IndexedDB trên máy, nên mở app tức thì và chạy offline. Một sync engine chạy nền đẩy thay đổi lên Drive và kéo thay đổi từ thiết bị khác về.

&#91;embedded content: kiến trúc · local-first, Drive làm kho đồng bộ\]

**appDataFolder của Drive bị cô lập theo OAuth Client ID**: file của Nhật ký nằm trong appDataFolder của OAuth client trong `src/config.ts`, ẩn khỏi Drive thường.

| Lớp | Chọn | Lý do |
| --- | --- | --- |
| Host | GitHub Pages, repo riêng `nhat-ky` | Miễn phí, origin `*.github.io` |
| Đăng nhập | Google Identity Services (token client) | Không cần backend; scope `drive.appdata` |
| Lưu trữ đám mây | Drive `appDataFolder` | Ẩn khỏi Drive thường, không bị xoá nhầm, free 15GB |
| Lưu trữ máy | IndexedDB qua thư viện Dexie | Truy vấn theo index ngày/loại, chứa được vài năm dữ liệu |
| UI | Vite + TypeScript + Preact | Tái dùng component, theme, font Be Vietnam Pro |
| Biểu đồ | SVG tự vẽ, hoặc Chart.js nếu cần heatmap | Nhẹ, không phụ thuộc |
| Offline + cài đặt | PWA: manifest + service worker | Cài lên màn hình chính điện thoại |

**Xử lý token hết hạn.** Access token Google chỉ sống khoảng 1 giờ và SPA thuần không có refresh token. Cách làm: khi gọi Drive bị lỗi 401, gọi lại token client với `prompt: ''` để xin token mới im lặng; nếu không được mới hiện nút "Đăng nhập lại". Trong lúc chờ, dữ liệu vẫn ghi vào IndexedDB, không mất gì.

**Cơ chế sync**

1. Mỗi bản ghi có `id` (UUID), `updatedAt`, `deviceId`, `deleted` (xoá mềm).
2. Ghi local → đánh dấu `dirty`. Sync chạy khi: mở app, quay lại tab, có mạng trở lại, và mỗi 60 giây nếu có `dirty`.
3. Dữ liệu chia file theo tháng (xem Data model) nên mỗi lần sync chỉ đọc/ghi 1–2 file nhỏ.
4. Xung đột: merge theo từng bản ghi, bản có `updatedAt` mới hơn thắng. Hai máy sửa cùng một bản ghi gần như không xảy ra với app một người.
5. Dùng `modifiedTime` của file Drive để biết file có đổi không, tránh tải lại thừa.

## Data model

Mọi thứ xảy ra trong ngày là một **Entry** có thời điểm; mỗi ngày có thêm một **Day** chứa điểm tự chấm. Định nghĩa (danh mục, thói quen, nút nhanh) nằm riêng. Thống kê luôn tính từ Entry + Day, không lưu sẵn.

**Ngày logic (giờ cắt ngày).** Một "ngày" trong app không kết thúc lúc 00:00 mà lúc **04:00 sáng hôm sau**. Lý do: nếu cắt đúng 0h, đêm thứ Hai mày đi ngủ lúc 00:40 sẽ bị tính là "thứ Ba đi ngủ 00:40", tối thứ Ba lại đi ngủ thêm lần nữa → thứ Ba có 2 lần đi ngủ, thứ Hai không có lần nào, thống kê sai hết.

| Thời điểm thực | Thuộc ngày logic | Ghi chú |
| --- | --- | --- |
| T2 07:00 thức dậy | T2 |  |
| T2 23:15 ăn khuya | T2 |  |
| T3 00:40 đi ngủ | **T2** | Trước 04:00 → vẫn là đêm thứ Hai |
| T3 02:00 còn ngồi code | **T2** | Tính vào giờ làm của thứ Hai (OT) |
| T3 04:00 trở đi | T3 | Ngày mới bắt đầu |
| T3 07:10 thức dậy | T3 |  |

Giấc ngủ là sự kiện vắt qua 2 ngày: **giờ đi ngủ gắn với đêm T2** ("tối T2 ngủ lúc 00:40"), **giờ dậy và thời lượng gắn với sáng T3** ("sáng T3 dậy 07:10, ngủ 6h30"). Chọn 04:00 vì lúc đó gần như chắc chắn mày đang ngủ; hôm nào thức tới 5h thì sửa tay. Giờ cắt chỉnh được trong cài đặt. Mỗi Entry lưu sẵn `dateKey` = ngày logic để lọc nhanh.

**Bố cục file trong appDataFolder**

| File | Nội dung | Kích thước ước tính |
| --- | --- | --- |
| `nk_settings.json` | Cài đặt, `dayStartHour` | < 5 KB |
| `nk_defs.json` | Danh mục, thói quen, tag, nút nhanh, ngưỡng luật | < 50 KB |
| `nk_2026-11.json` | Toàn bộ Entry + Day của tháng 11/2026 (chỉ chứa id ảnh, không chứa ảnh) | \~30 entry/ngày → 100–200 KB/tháng |
| `nk_insights.json` | Lời khuyên đã sinh, trạng thái (đã xem/bỏ qua/đang thử) | < 50 KB |
| `nkp_<photoId>.webp` / `nkt_<photoId>.webp` | Ảnh gốc đã nén / ảnh thu nhỏ, mỗi ảnh một file (Module 10) | \~200 KB / \~20 KB mỗi ảnh |

Tiền tố `nk_` để file của Nhật ký luôn nhận ra được trong appDataFolder.

**Entry**

| Trường | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | UUID |  |
| `type` | enum | `sleep`, `meal`, `work`, `habit`, `exercise`, `activity`, `water`, `note` |
| `dateKey` | `YYYY-MM-DD` | Ngày logic |
| `start` | ISO datetime | Bắt buộc |
| `end` | ISO datetime / null | Có với sự kiện kéo dài (ngủ, làm việc, tập) |
| `categoryId` | string | Trỏ vào danh mục, vd `work.deep`, `meal.lunch` |
| `title` | string | "Phở bò", "Fix SP CP\_RO\_DVBK03" |
| `value` / `unit` | number / string | Số lượng: 2 (ly), 45 (phút), 1.5 (lít) |
| `rating` | 1–5 / null | Tuỳ loại: chất lượng ngủ, độ tập trung, độ ngon |
| `tags` | string\[\] | "cà phê", "ăn ngoài", "OT". Ảnh: mảng \`photoIds\` (tối đa 3) |
| `payload` | object | Trường riêng theo loại, mô tả ở từng module |
| `source` | enum | `manual`, `quick` (bấm nút trong lúc đó, giờ là thời gian thực), `backfill` (ghi bù ở tab Ghi bù, giờ là ước lượng) |
| `note` | string |  |
| `createdAt`, `updatedAt`, `deviceId`, `deleted` |  | Phục vụ sync |

**Day**

| Trường | Kiểu | Ghi chú |
| --- | --- | --- |
| `dateKey` | `YYYY-MM-DD` | Khoá chính |
| `mood`, `energy`, `stress`, `focus` | 1–5 | Chấm cuối ngày, có thể chấm thêm buổi sáng |
| `dayScore` | 1–10 | "Hôm nay ổn tới đâu" — biến mục tiêu chính cho phân tích |
| `highlight` | string | Một việc đáng nhớ nhất |
| `dayType` | enum | `workday`, `weekend`, `holiday`, `sick`, `travel` — để loại ngày bất thường khỏi phân tích |
| `note` | string |  |
| `updatedAt`, `deviceId` |  |  |

**Định nghĩa (trong `nk_defs.json`)**

- `categories[]`: id, tên, loại Entry, màu, icon, thứ tự, `archived`.
- `habits[]`: xem Module 2.
- `quickActions[]`: nút bấm nhanh = mẫu Entry dựng sẵn (loại, danh mục, title, value mặc định).
- `tags[]`: id, tên, màu. `Entry.tags` lưu **id** tag.
- Danh mục có thêm `group` (`work` / `growth` / `personal`) để gom giờ ở màn Thời gian; mặc định theo loại.
- Quản lý (thêm, sửa, ẩn, sắp xếp) ở Cài đặt → "Sửa danh mục, nút nhanh và tag". Sắp xếp bằng nút ↑ ↓ (điện thoại), không kéo thả.

Không xoá cứng định nghĩa đã có dữ liệu; chỉ `archived` để thống kê cũ không vỡ.

## Module 1 — Ghi nhanh & Timeline ngày

Đây là màn hình mở app mặc định và quyết định app có sống được không: ghi phải nhanh, nhìn lại phải rõ.

**1.1 Màn hình Hôm nay**

- Trên cùng: ngày logic, nút ◀ ▶ đổi ngày, thanh tiến độ "đã ghi x/y mục cốt lõi" (ngủ, 3 bữa, làm việc, chấm ngày).
- Lưới **nút nhanh** 2×4 (tuỳ chỉnh được): Thức dậy, Đi ngủ, Ăn sáng, Ăn trưa, Ăn tối, Bắt đầu làm, Uống nước, Cà phê.
- **Không có timer** (đổi 21/10: Đạt không bật được liên tục). Việc làm được ghi bằng thời gian ước lượng: chạm "Làm việc" → chọn "vừa làm xong bao lâu" (15p … 4h); khối kết thúc bây giờ và bắt đầu cách đây đúng khoảng đó.
- **Check-in nhanh**: chạm 1–5 cho năng lượng hoặc tâm trạng ngay lúc đó (Module 5.3).
- **Timeline dọc** theo giờ: mỗi Entry là một khối, khối kéo dài có chiều cao theo thời lượng, màu theo danh mục. Khoảng trống > 2 tiếng chưa ghi gì hiện vạch mờ "chưa ghi" để bấm điền.
- Nút **+** nổi góc dưới: mở form đầy đủ.

**1.2 Cách ghi**

| Cách | Thao tác | Kết quả |
| --- | --- | --- |
| Chạm nút nhanh | 1 chạm | Tạo Entry với giờ = bây giờ, giá trị mặc định. Hiện toast 5 giây có nút "Sửa" / "Hoàn tác" |
| Nhấn giữ nút nhanh | 2 chạm | Mở form điền sẵn để chỉnh giờ, giá trị, ghi chú |
| Chạm "Làm việc" + chọn thời lượng ước lượng | 2 chạm | Entry kết thúc bây giờ, bắt đầu cách đây đúng khoảng đó, `source = quick` |
| Tab **Ghi bù** | 2–3 chạm | Cho việc đã làm xong mà chưa kịp bấm: chọn ngày, chạm một mục (giờ mặc định theo thói quen, ví dụ ăn trưa 12:00), chỉnh giờ hoặc chip thời lượng, Lưu. `source = backfill`, hiện nhãn "ghi bù" trên timeline |
| Form đầy đủ (+) | Chọn loại → điền | Dùng khi ghi bù |
| Chép từ hôm qua | 1 chạm trên một khối của hôm qua | Copy sang hôm nay, giữ giờ |
| Điền khoảng trống | Chạm vạch "chưa ghi" | Form với `start`/`end` điền sẵn theo khoảng trống |

**1.3 Form đầy đủ**

- Trường chung: loại, danh mục, title (có gợi ý từ lịch sử, sắp theo tần suất), giờ bắt đầu, giờ kết thúc hoặc thời lượng, giá trị + đơn vị, rating, tag, ghi chú.
- Trường riêng theo loại hiện thêm bên dưới (xem từng module).
- Chọn giờ: mặc định "bây giờ", có nút nhanh −15p, −30p, −1h.
- Validate: `end` > `start`; cảnh báo (không chặn) nếu trùng giờ với Entry kéo dài khác cùng loại.

**1.4 Review cuối ngày**

- Sau 21:30 (chỉnh được), mở app thấy banner "Chấm ngày hôm nay" (nhắc trong app — phương án A; push để sau).
- Một màn: 4 thanh trượt 1–5 (tâm trạng, năng lượng, stress, tập trung), điểm ngày 1–10, ô highlight, loại ngày.
- Bên dưới: danh sách thói quen hôm nay chưa tick để tick nốt.
- Chưa chấm thì sáng hôm sau hỏi lại một lần, sau đó bỏ qua.

**1.5 Sửa / xoá**

- Chạm khối → xem chi tiết → Sửa / Nhân bản / Xoá. Xoá là xoá mềm, có Hoàn tác.
- Kéo cạnh dưới khối để đổi giờ kết thúc (PC; điện thoại để V2).

**Tiêu chí xong:** từ lúc mở app tới lúc ghi xong "Ăn trưa" ≤ 5 giây; timeline đúng giờ khi có Entry qua nửa đêm.

## Module 2 — Thói quen

Theo dõi thói quen tốt muốn xây và thói quen xấu muốn bỏ, có mục tiêu, lịch và streak. Mỗi lần tick là một Entry `type = habit`, nên thói quen cũng tham gia phân tích tương quan như mọi thứ khác.

**2.1 Định nghĩa thói quen**

| Trường | Giá trị | Ví dụ |
| --- | --- | --- |
| `name` | string | Đọc sách, Không lướt TikTok sau 23h |
| `direction` | `build` / `quit` | Xây / bỏ |
| `kind` | `check` / `count` / `duration` | Có/không · số lần · số phút |
| `target` | number + phép so sánh | ≥ 20 phút · ≥ 8 ly · = 0 lần |
| `schedule` | hằng ngày / thứ cụ thể / x lần mỗi tuần | T2–T6 · 3 lần/tuần |
| `reminderTime` | HH:mm / null | 22:00 |
| `linkedRule` | tuỳ chọn | Tự tick từ Entry khác: "Uống nước" tự đếm từ Entry `water` |
| `metricRule` | tuỳ chọn | Tự đạt khi một chỉ số qua ngưỡng, ví dụ `wake_time ≤ 7` ("Dậy trước 7h", lấy đêm hôm trước) hay `bedtime ≤ 23,5` ("Ngủ trước 23h30") |
| `startDate`, `archived` |  |  |

**2.2 Màn hình Thói quen**

- Danh sách thói quen hôm nay theo lịch, mỗi dòng: tên, tiến độ (3/8 ly), nút tick hoặc +1.
- Streak hiện tại và streak dài nhất.
- Lưới heatmap 12 tuần cho từng thói quen (ô đậm = đạt, nhạt = một phần, trống = trượt, gạch chéo = không có lịch).

**2.3 Cách tính**

- **Đạt ngày**: giá trị trong ngày logic thoả `target`.
- **Streak**: số ngày có lịch liên tiếp đều đạt; ngày không có lịch không làm đứt streak. Với lịch "x lần/tuần", streak tính theo tuần.
- **Tỷ lệ hoàn thành**: số ngày đạt / số ngày có lịch, theo 7, 30, 90 ngày.
- **Ngày nghỉ phép**: ngày có `dayType = sick` hoặc `travel` không tính trượt (tuỳ chọn bật).
- Thói quen `quit`: "đạt" khi số lần = 0 (hoặc dưới ngưỡng); ghi lại mỗi lần vi phạm để biết giờ nào hay vi phạm.

**2.4 Gợi ý thói quen mẫu khi mới dùng**

Dậy trước 7h, Ngủ trước 23h30, Uống đủ 2 lít nước, Đọc sách 20 phút, Vận động 30 phút, Không màn hình 30 phút trước ngủ. Mặc định chỉ bật 3, còn lại để chọn.

**Tiêu chí xong:** tick xong một thói quen ≤ 2 chạm; streak đúng khi có ngày không nằm trong lịch.

## Module 3 — Ăn uống

Ghi bữa ăn theo kiểu "lúc nào, cái gì, ở đâu, ăn xong thấy sao" — không đếm calo, không ghi tiền. Thứ quan trọng nhất là **giờ ăn**: nhịp ăn (bỏ bữa, ăn khuya, ăn sát giờ ngủ, khung ăn dài/ngắn) tác động trực tiếp lên giấc ngủ, năng lượng và tập trung.

**3.1 Loại Entry**

- `meal`: bữa chính hoặc bữa phụ.
- `water`: mỗi lần uống, `value` = ml (nút nhanh 250ml).
- Đồ uống có caffeine/cồn ghi là `meal` với `payload.drink` để phân tích riêng (cà phê, trà sữa, bia).

**3.2 Payload `meal`**

| Trường | Giá trị |
| --- | --- |
| `mealSlot` | `breakfast` / `lunch` / `dinner` / `snack` / `late` (sau 22h, tự gán theo giờ) |
| `items[]` | Tên món, có gợi ý từ lịch sử: "Phở bò", "Cơm văn phòng" |
| `place` | `home` / `office` / `out` / `delivery` |
| `portion` | ít / vừa / no căng |
| `quality` | Tự đánh giá healthy 1–3: nhiều rau / bình thường / dầu mỡ, đồ ngọt |
| `drink` | `coffee` / `tea` / `milktea` / `alcohol` / `soft` + số lượng |
| `afterFeel` | Sau ăn: tỉnh táo / bình thường / buồn ngủ / khó chịu (hỏi lại sau 1h, tuỳ chọn) |
| `photoIds` | Tối đa 3 ảnh món ăn (Module 10) |
| `timeSource` | `manual` / `photo` (lấy giờ chụp ảnh) |

**Lấy giờ ăn tự động** — 2 nguồn, ưu tiên từ trên xuống:

1. Giờ chụp ảnh món ăn (đọc từ thông tin ảnh) — sát giờ ăn nhất.
2. Giờ bấm nút nhanh.

**3.3 Màn hình Ăn uống**

- Hôm nay: 3 ô bữa chính (đã ghi / chưa), thanh nước uống x/2000ml, số ly cà phê.
- Tuần: bảng 7 ngày × bữa, ô trống = bỏ bữa, ô đỏ = ăn khuya.
- Thống kê 30 ngày: giờ ăn trung bình mỗi bữa, số bữa bỏ, tỷ lệ ăn ngoài, món hay ăn nhất, khung ăn trung bình (bữa đầu → bữa cuối).

**3.4 Chỉ số đưa vào phân tích**

Giờ bữa đầu, giờ bữa cuối, **khung ăn** (bữa đầu → bữa cuối, giờ), **khoảng cách bữa cuối → giờ ngủ**, có ăn khuya không, số ly cà phê, **khoảng cách ly cà phê cuối → giờ ngủ**, lượng nước, bỏ bữa sáng không, điểm healthy trung bình ngày, có uống rượu bia không.

**Tiêu chí xong:** ghi "Ăn trưa – cơm văn phòng" ≤ 3 chạm nhờ gợi ý lịch sử.

## Module 4 — Công việc & quản lý thời gian

Ghi thời gian làm việc theo khối (ước lượng thời lượng; không dùng timer) để biết mày thực sự dùng giờ vào đâu, giờ nào tập trung nhất, và OT bao nhiêu. Không thay thế Jira hay task tool của công ty.

**4.1 Danh mục mặc định (sửa được)**

| Nhóm | Danh mục con |
| --- | --- |
| Công việc chính | Deep work (code, viết SP), Họp, Hỗ trợ/fix lỗi khách, Email/chat, Học trong việc |
| Phát triển bản thân | Học BA, Side project, Đọc sách chuyên môn |
| Cá nhân | Việc nhà, Di chuyển, Giải trí, Mạng xã hội, Gặp bạn bè/gia đình |

**4.2 Payload `work` / `activity`**

- `project`: tên dự án/hệ thống tự do, có gợi ý: "CyberApp Golden", "QLBX", "Nhật ký".
- `focus`: 1–5, điền trong form (tuỳ chọn).
- `interruptions`: số lần bị cắt ngang, điền tay trong form (tuỳ chọn).
- `location`: văn phòng / nhà / quán.
- `isOvertime`: tự đặt `true` nếu ngoài giờ làm việc khai báo trong cài đặt (vd 8:00–17:30, T2–T6).

**4.3 Màn hình Thời gian**

- Hôm nay: tổng giờ theo nhóm, vòng tròn tỷ lệ, so với trung bình 30 ngày.
- Tuần: cột chồng theo ngày × nhóm; dòng tổng giờ deep work.
- Heatmap giờ trong ngày × thứ: ô nào mày hay deep work và focus cao.
- Theo dự án: tổng giờ mỗi dự án trong tháng.

**4.4 Mục tiêu thời gian (tuỳ chọn)**

Đặt ngân sách tuần: deep work ≥ 15h, học BA ≥ 4h, mạng xã hội ≤ 7h. Hiện thanh tiến độ, đưa vào lời khuyên khi lệch.

**4.5 Chỉ số đưa vào phân tích**

Tổng giờ làm, giờ deep work, focus trung bình, số lần bị ngắt, giờ OT, giờ học BA, giờ mạng xã hội, giờ bắt đầu làm việc đầu tiên.

**Tiêu chí xong:** ghi một khối làm việc bằng thời lượng ước lượng ≤ 2 chạm; tổng giờ một ngày khớp tổng các khối.

## Module 5 — Ngủ, vận động, tâm trạng & năng lượng

Ba thứ này là biến "đầu ra" chính của phân tích: hầu hết lời khuyên sẽ trả lời câu "làm gì để ngủ ngon hơn, có năng lượng hơn, ngày tốt hơn".

**5.1 Giấc ngủ (`type = sleep`)**

- Ghi bằng 2 nút nhanh, chỉ cần bấm, app tự lưu giờ: **Đi ngủ** (tạo Entry mở, chỉ có `start`) và **Thức dậy** (đóng Entry đang mở, điền `end`; chất lượng 1–5 là tuỳ chọn, bỏ qua được).
- Quên bấm "Đi ngủ" thì "Thức dậy" vẫn ghi một giấc ngủ với giờ ngủ ước lượng (giờ ngủ thường lệ 7 ngày, kẹp trong 2–14 giờ, không thì mục tiêu ngủ trước giờ dậy), `payload.estimated = true`. App không hỏi lại giờ ngủ. Sai thì sửa ở Hôm nay hoặc Ghi bù.
- Payload: `quality` 1–5, `wakeUps` số lần tỉnh giữa đêm, `screenBeforeBed` có/không, `alarm` dậy bằng báo thức hay tự dậy.
- Ngủ trưa: Entry `sleep` có `payload.nap = true`, không tính vào giấc chính.
- Chỉ số dẫn xuất: giờ đi ngủ, giờ dậy, thời lượng, **độ lệch giờ ngủ** (độ lệch chuẩn giờ đi ngủ 7 ngày — càng thấp càng đều), nợ ngủ so với mục tiêu (mặc định 7,5h).

**5.2 Vận động (`type = exercise`)**

- Payload: `kind` (chạy, gym, đạp xe, đi bộ, cầu lông, bóng đá...), `duration` phút, `intensity` nhẹ / vừa / nặng, `distance` km tuỳ chọn.
- Chỉ số: số phút vận động/tuần (mốc tham khảo phổ biến là 150 phút mức vừa/tuần), số ngày có vận động, giờ tập.

**5.3 Tâm trạng & năng lượng**

- Chấm cuối ngày nằm ở Day (Module 1.4).
- Thêm **check-in nhanh** bất kỳ lúc nào: chạm emoji 1–5 + chọn vài tag cảm xúc (vui, mệt, lo, cáu, chán, hào hứng). Lưu là Entry `note` với `payload.checkin`.
- Dùng để vẽ đường năng lượng trong ngày và tìm "giờ tụt năng lượng" (vd 14–15h sau ăn trưa).

**5.4 Màn hình Sức khoẻ**

- Biểu đồ 30 ngày: thanh ngủ (giờ ngủ → giờ dậy) theo ngày, đường điểm chất lượng.
- Lịch tháng tô màu theo điểm ngày.
- Tóm tắt tuần: ngủ trung bình, độ đều, phút vận động, tâm trạng trung bình, so với tuần trước.

**5.5 Chỉ số đồng hồ sinh hoạt**

Đây là trọng tâm của app: không chỉ "ngủ bao lâu" mà "nhịp sống có đều và có hợp với cơ thể không".

| Chỉ số | Cách tính | Ý nghĩa |
| --- | --- | --- |
| Điểm giữa giấc ngủ | (giờ ngủ + giờ dậy) / 2 | Mốc ổn định nhất để biết mày là người ngủ sớm hay cú đêm |
| Lệch giờ ngủ ngày thường/cuối tuần | Điểm giữa giấc ngủ T7–CN trừ T2–T6 | Lệch > 1h = kiểu "jet lag" mỗi tuần, hay gây mệt đầu tuần |
| Độ đều giờ ngủ | Độ lệch chuẩn giờ đi ngủ 7 ngày | Đều quan trọng ngang thời lượng |
| Khung ăn | Bữa đầu → bữa cuối | Khung quá dài, ăn rải rác tới khuya |
| Bữa cuối → ngủ | Giờ đi ngủ − giờ bữa cuối | Ăn sát giờ ngủ hay đi kèm ngủ kém |
| Cà phê cuối → ngủ | Giờ đi ngủ − giờ ly cà phê cuối | Caffeine còn tác dụng nhiều giờ |
| Giờ bắt đầu làm sau khi dậy | Giờ khối làm việc đầu tiên − giờ dậy |  |
| Đường năng lượng trong ngày | Check-in năng lượng theo giờ, gộp 30 ngày | Tìm khung giờ đỉnh để xếp deep work, khung tụt để nghỉ |
| Ra ngoài trời buổi sáng | Nút nhanh "Ra ngoài trời" trước 10h (có/không) | Ánh sáng buổi sáng giúp chỉnh nhịp ngủ |

**Lưu ý:** app không chẩn đoán sức khoẻ. Lời khuyên chỉ nói về thói quen và số liệu của chính mày.

**Tiêu chí xong:** ghi trọn một giấc ngủ chỉ bằng 2 lần bấm (tối + sáng), không phải nhập giờ; giấc ngủ qua nửa đêm gán đúng ngày logic.

## Module 6 — (đã bỏ)

Đã bỏ: không lấy giờ ăn từ app ngoài. Giờ ăn lấy từ nhập tay, nút nhanh và giờ chụp ảnh (Module 10). Giữ số Module để không lệch tham chiếu.

## Module 7 — Thống kê & Dashboard

Dashboard trả lời 3 câu theo thứ tự: tuần này thế nào, đang tốt lên hay xấu đi, và cái gì đi kèm với ngày tốt. Mọi số tính từ IndexedDB tại chỗ, không cần mạng.

**7.1 Bố cục**

1. **Thẻ tuần** (7 ngày gần nhất vs 7 ngày trước): ngủ TB, độ đều giờ ngủ, deep work, phút vận động, tâm trạng TB, điểm ngày TB, điểm giữa giấc ngủ. Mỗi thẻ có mũi tên ↑↓ và % thay đổi.
2. **Lời khuyên nổi bật**: 1–3 thẻ từ Module 8.
3. **Xu hướng 90 ngày**: chọn 1–2 chỉ số để vẽ đường, có đường trung bình trượt 7 ngày.
4. **Lịch tháng**: tô màu theo chỉ số chọn (điểm ngày, giờ ngủ, deep work).
5. **Tương quan**: danh sách "đi kèm ngày tốt" và "đi kèm ngày tệ" (Module 8.3).
6. **Theo thứ trong tuần**: cột trung bình mỗi chỉ số theo T2…CN.

**7.2 Danh mục chỉ số tính sẵn (metric registry)**

Mọi chỉ số khai báo một chỗ dưới dạng hàm `(dateKey) → number | null`, để dashboard, phân tích và lời khuyên dùng chung một định nghĩa.

| Nhóm | Chỉ số |
| --- | --- |
| Ngủ | giờ đi ngủ, giờ dậy, thời lượng, chất lượng, độ lệch giờ ngủ 7 ngày, có màn hình trước ngủ, điểm giữa giấc ngủ, lệch ngày thường/cuối tuần, ra ngoài trời buổi sáng |
| Ăn uống | giờ ăn tối, ăn khuya (0/1), số ly cà phê, giờ ly cà phê cuối, nước (ml), bỏ bữa sáng (0/1), điểm healthy, rượu bia (0/1), khung ăn, bữa cuối → ngủ, cà phê cuối → ngủ |
| Thời gian | giờ làm, deep work, focus TB, số lần bị ngắt, giờ OT, giờ học BA, giờ mạng xã hội, giờ bắt đầu làm |
| Vận động | phút vận động, có vận động (0/1) |
| Thói quen | đạt/không từng thói quen, tỷ lệ hoàn thành ngày |
| Chủ quan | tâm trạng, năng lượng, stress, tập trung, điểm ngày |

`null` nghĩa là ngày đó không ghi — khác với 0. Phân tích bỏ qua `null`, không coi là 0.

**7.3 Xuất báo cáo**

Nút "Báo cáo tuần" sinh trang tóm tắt có thể chụp/in; xuất CSV toàn bộ Entry theo khoảng ngày.

**Tiêu chí xong:** dashboard mở < 1 giây với 1 năm dữ liệu; số trên thẻ khớp tính tay trên 7 ngày mẫu.

## Module 8 — Engine phân tích & lời khuyên

V1 gồm 3 lớp chạy hoàn toàn trên máy: **luật cảnh báo** (phát hiện ngay), **tương quan** (tìm cái đi kèm ngày tốt/tệ, cần ≥ 4 tuần dữ liệu), và **thí nghiệm** (kiểm chứng một thay đổi). V2 thêm AI viết nhận xét tuần. Engine chạy 1 lần mỗi ngày khi mở app, kết quả lưu `nk_insights.json`.

**8.1 Mức độ sẵn sàng dữ liệu**

| Số ngày có dữ liệu | App làm được |
| --- | --- |
| < 7 | Chỉ thống kê mô tả, hiện "cần thêm x ngày" |
| 7–27 | Luật cảnh báo, so sánh tuần này vs tuần trước |
| ≥ 28 | Tương quan cùng ngày, mỗi nhóm so sánh ≥ 7 ngày |
| ≥ 60 | Tương quan trễ 1 ngày (hôm nay → mai), theo thứ trong tuần |

Các app tương tự cũng mất vài tháng mới cho insight đáng tin, nên app nói rõ mức hiện tại thay vì bịa kết luận sớm.

**8.2 Luật cảnh báo (rule engine)**

Mỗi luật khai báo: `id`, điều kiện trên metric registry, cửa sổ ngày, mức ưu tiên, mẫu câu, thời gian chờ trước khi nhắc lại. Luật mặc định:

| Luật | Điều kiện | Lời khuyên mẫu |
| --- | --- | --- |
| Thiếu ngủ liên tiếp | Ngủ < 6h trong 3 ngày liền | "3 đêm liền ngủ dưới 6h (TB 5h20). Tối nay ưu tiên lên giường trước 23h." |
| Giờ ngủ thất thường | Độ lệch giờ đi ngủ 7 ngày > 60 phút | "Giờ ngủ tuần này lệch ±75 phút. Chọn một giờ cố định và giữ 5 ngày." |
| Cà phê muộn | Ly cuối sau 15h ≥ 3 ngày/tuần | "4 ngày tuần này uống cà phê sau 15h." (kèm tương quan với chất lượng ngủ nếu đã có) |
| Bỏ bữa sáng | ≥ 3/7 ngày | "Bỏ bữa sáng 4/7 ngày." |
| Ăn khuya | ≥ 3/7 ngày có bữa sau 22h |  |
| Thiếu vận động | < 150 phút trong 7 ngày | "Tuần này vận động 60/150 phút." |
| Deep work hụt | < 70% ngân sách tuần tính đến hôm nay |  |
| OT nhiều | > 10h OT/tuần |  |
| Mạng xã hội vượt | > ngân sách tuần |  |
| Streak sắp đứt | 21h, thói quen có lịch hôm nay chưa đạt, streak ≥ 5 | "Đọc sách đang streak 12 ngày, còn 20 phút nữa." |
| Ít nước | < 1,5 lít, 3 ngày liền |  |

Ngưỡng nằm trong cài đặt, sửa được.

**8.3 Tương quan (correlation engine)**

Với mỗi cặp *yếu tố X* × *kết quả Y*:

1. **Kết quả Y**: điểm ngày, tâm trạng, năng lượng, tập trung, chất lượng ngủ, giờ deep work.
2. **Yếu tố X**: mọi chỉ số còn lại trong registry. X nhị phân (có/không) chia 2 nhóm; X liên tục chia nhóm thấp 1/3 và cao 1/3.
3. **Hai kiểu ghép ngày**: cùng ngày (cà phê hôm nay ↔ tập trung hôm nay) và trễ 1 ngày (giờ ngủ đêm nay ↔ năng lượng mai). Giấc ngủ gắn với ngày thức dậy khi xét Y của ngày đó.
4. **Tính**: chênh lệch trung bình Y giữa 2 nhóm và cỡ hiệu ứng (Cohen's d).
5. **Lọc để tránh báo nhầm** (so hàng chục cặp sẽ luôn có cặp trùng hợp):
   - Mỗi nhóm ≥ 7 ngày.
   - |d| ≥ 0,5.
   - **Kiểm tra nửa kia**: chia dữ liệu làm 2 nửa theo thời gian, cả 2 nửa phải cùng chiều.
   - Loại ngày có `dayType` = sick / travel / holiday.
6. **Độ tin cậy** hiển thị: Yếu (vừa qua ngưỡng) / Vừa (d ≥ 0,8 hoặc mỗi nhóm ≥ 15 ngày) / Mạnh (cả hai).

Kết quả hiện dạng câu có số: "Ngày mày ngủ trước 23h30 (14 ngày), điểm ngày TB **7,4**; ngày ngủ muộn hơn (19 ngày) TB **6,1**. Độ tin cậy: Vừa."

**8.4 Sinh lời khuyên**

- Mỗi insight (từ luật hoặc tương quan) map sang một mẫu lời khuyên có hành động cụ thể + mốc thời gian: "Thử ngủ trước 23h30 trong 5 ngày tới".
- Xếp hạng: độ tin cậy × độ lớn hiệu ứng × mức có thể thay đổi được (giờ ngủ thay đổi được; thứ trong tuần thì không → chỉ để thông tin).
- Mỗi ngày hiện tối đa 3 lời khuyên. Không lặp lại lời khuyên đã bị bỏ qua trong 14 ngày.
- Mỗi thẻ có nút: **Thử** (tạo thí nghiệm), **Hữu ích**, **Không đúng**, **Ẩn 2 tuần**. Phản hồi "Không đúng" hạ trọng số loại insight đó.

**8.5 Thí nghiệm**

1. Bấm "Thử" → tạo thí nghiệm: thay đổi gì (vd ngủ trước 23h30), đo gì (năng lượng), thời gian 14 ngày.
2. Tự tạo thói quen tạm thời để tick hằng ngày.
3. Hết hạn: so 14 ngày thí nghiệm với 14 ngày trước đó, chỉ tính ngày thực sự làm đúng. Hiện kết quả + hỏi "Giữ thành thói quen?".

**8.6 V2 — AI**

Gói Claude trả phí (dùng trên app/web) **không kèm API**: API tính tiền riêng qua Claude Console theo số token. Theo trang hỗ trợ của Anthropic, gói Max và Team có kèm credit API hằng tháng; gói Pro thì tao không chắc có — mày kiểm tra gói của mày. Hai cách nối với Claude:

| Cách | Hoạt động | Chi phí | Nhược |
| --- | --- | --- | --- |
| **A. Nút "Hỏi Claude" (đề xuất làm trước)** | App dựng sẵn một đoạn prompt gồm bảng chỉ số 7–30 ngày + insight đã có + câu hỏi. Bấm nút → copy và mở app Claude, mày dán vào chat | 0đ, dùng luôn gói đang trả | Thủ công 2 thao tác; kết quả không tự lưu vào Nhật ký (có ô dán ngược lại nếu muốn) |
| **B. Gọi API trực tiếp** | App gọi API với key mày tự tạo trong Claude Console, key lưu local trên điện thoại | Trả theo token, hoặc trừ vào credit nếu gói có | Site tĩnh không giấu được key → chỉ chấp nhận vì app một người dùng; phải tự quản lý hạn mức |

Với cả hai cách: chỉ gửi **số liệu tổng hợp**, không gửi ghi chú tự do và ảnh. Dùng cho: nhận xét tuần, "vì sao tuần này mệt", và sau này nhập bằng câu tự nhiên ("ăn phở 7h rồi đi làm" → tách Entry, cần cách B).

**Tiêu chí xong V1:** với bộ dữ liệu giả 60 ngày có cài sẵn quy luật (ngủ sớm → năng lượng +1), engine tìm ra đúng quy luật đó và không báo quá 2 quy luật giả.

## Module 9 — Cài đặt, backup, bảo mật

**9.1 Cài đặt**

- Giờ cắt ngày logic (mặc định 04:00), giờ làm việc chuẩn (để tính OT), mục tiêu ngủ, nước, vận động.
- Quản lý danh mục, tag, nút nhanh (kéo thả sắp xếp), thói quen.
- Ngưỡng các luật cảnh báo, bật/tắt từng luật.
- Giao diện: sáng/tối/theo máy.

**9.2 Nhắc nhở — hạn chế cần biết**

Webapp tĩnh **không tự bắn thông báo đúng giờ khi app đang đóng**. Muốn vậy phải có Web Push, tức cần một server gửi push; trên iPhone, PWA chỉ nhận push khi đã "Thêm vào màn hình chính". Các phương án:

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| A. Chỉ nhắc khi mở app (badge, banner trong app) | Không cần server, làm ngay | Không mở app thì không nhắc |
| B. Tạo sự kiện lặp trên Google Calendar qua API | Không cần server, nhắc chắc chắn trên điện thoại | Thêm scope Calendar; nhắc cố định, không biết đã ghi hay chưa |
| C. Web Push qua serverless free (Cloudflare Workers + cron) | Nhắc thông minh (chỉ nhắc khi chưa ghi) | Thêm một thành phần phải vận hành; server cần đọc được trạng thái |

**Đã chốt:** bản đầu làm A. Dùng ổn thì chuyển sang C. Vì dùng chủ yếu trên điện thoại, nếu là iPhone thì phải "Thêm vào màn hình chính" mới nhận được push ở phương án C.

**9.3 Backup & khôi phục**

- Drive đã là bản sao chính; thêm: mỗi Chủ nhật tự tạo bản snapshot `nk_backup_YYYY-MM-DD.json` trong appDataFolder, giữ 8 bản gần nhất.
- Xuất thủ công: JSON đầy đủ, CSV theo loại Entry.
- Nhập: từ file JSON (khôi phục) và CSV (nhập dữ liệu cũ nếu có).
- Đổi máy: đăng nhập Google → tải về toàn bộ file tháng → dựng lại IndexedDB.

**9.4 Bảo mật & riêng tư**

- Dữ liệu chỉ nằm trên máy và Drive của mày; không có server trung gian.
- Scope tối thiểu `drive.appdata` (+ `calendar.events` chỉ khi sau này cần, bản đầu không dùng).
- OAuth consent screen để chế độ Testing, thêm email mày vào test user → không cần Google duyệt app.
- Khoá app bằng passkey/Face ID (tuỳ chọn).
- Ghi chú tự do không bao giờ gửi đi đâu ở V1; V2 gửi AI chỉ gửi số liệu tổng hợp.

## Module 10 — Ảnh

Cho phép đính ảnh vào Entry (chủ yếu món ăn), nhưng nén trên điện thoại trước khi lưu và tách ảnh khỏi dữ liệu chính, để ảnh không làm chậm sync. Ảnh còn có lợi cho đồng hồ sinh hoạt: **giờ chụp chính là giờ ăn chính xác nhất**.

**10.1 Nén và lưu**

- Chụp/chọn ảnh → vẽ lại lên canvas → xuất **WebP chất lượng \~0,7, cạnh dài 1280px** (\~150–250 KB, ảnh gốc điện thoại thường 3–6 MB) + **ảnh thu nhỏ 320px** (\~15–25 KB).
- Vẽ lại qua canvas tự xoá thông tin vị trí GPS trong ảnh; trước đó app đọc giờ chụp để gợi ý giờ ăn.
- Mỗi ảnh là một file riêng trong appDataFolder; file tháng chỉ giữ `photoIds`. Sync dữ liệu không phải chờ ảnh.
- Hàng đợi tải ảnh riêng, có tuỳ chọn "chỉ tải ảnh khi có Wi-Fi". Chưa tải xong vẫn xem được vì ảnh nằm sẵn trong IndexedDB.
- Tối đa 3 ảnh mỗi Entry.

**10.2 Hiển thị**

- Timeline và danh sách chỉ tải ảnh thu nhỏ; chạm mới tải ảnh lớn.
- Bộ nhớ đệm ảnh lớn trên máy giới hạn \~200 MB, ảnh cũ nhất bị xoá khỏi máy trước (vẫn còn trên Drive).
- Xoá Entry → xoá luôn file ảnh trên Drive.

**10.3 Ước tính dung lượng**

| Mức dùng | Mỗi năm (ảnh lớn + thu nhỏ) |
| --- | --- |
| 3 ảnh/ngày (3 bữa) | \~250 MB |
| 6 ảnh/ngày | \~500 MB |
| 10 ảnh/ngày | \~850 MB |

Drive miễn phí 15 GB dùng chung với Gmail và Google Photos, và file trong appDataFolder vẫn tính vào dung lượng đó. 3–6 ảnh/ngày dùng được nhiều năm. Thêm tuỳ chọn "sau 12 tháng chỉ giữ ảnh thu nhỏ" để giảm \~90% nếu sau này đầy.

**10.4 Backup**

Bản snapshot hằng tuần chỉ chứa JSON, không chứa ảnh. Xuất toàn bộ thì có lựa chọn "kèm ảnh" (file zip).

**Tiêu chí xong:** chụp ảnh món ăn → Entry có giờ = giờ chụp, ảnh < 300 KB, sync dữ liệu không bị chậm khi đang tải ảnh.

## Roadmap & tiêu chí nghiệm thu

Mốc: **21–31/10 build đủ P0–P3 và test bằng dữ liệu giả; từ 1/11 nhập dữ liệu thật**. Engine phân tích làm xong trước, nhưng tự bật theo lượng dữ liệu thật (bảng 8.1), không cần sửa code thêm.

&#91;embedded content: roadmap · 5 phase, 4 cổng\]

**Lịch bật tính năng sau 1/11** (tính từ ngày có dữ liệu thật):

| Ngày | Bật |
| --- | --- |
| 1/11 | Ghi chép, timeline, thói quen, ảnh, thống kê mô tả |
| \~8/11 (7 ngày) | Luật cảnh báo, so tuần này với tuần trước |
| \~29/11 (28 ngày) | Tương quan cùng ngày, thí nghiệm |
| \~31/12 (60 ngày) | Tương quan trễ 1 ngày, phân tích theo thứ trong tuần |

**Dữ liệu giả để test:** viết một script sinh 60 ngày dữ liệu có cài sẵn quy luật (vd ngủ trước 23h30 → năng lượng hôm sau +1), dùng để test dashboard, luật và tương quan trước 31/10. Trước khi dùng thật thì xoá sạch dữ liệu giả (nút "Xoá dữ liệu test" chỉ hiện ở chế độ dev).

**Rủi ro:** 10 ngày làm ngoài giờ cho P0–P3 là rất sát. Thứ tự ưu tiên nếu trễ: phần ghi chép (P0–P1) bắt buộc xong 31/10 vì dữ liệu bắt đầu từ 1/11; P2–P3 có thể làm tiếp đầu tháng 11 mà không mất dữ liệu, vì engine chỉ cần dữ liệu đã ghi. P4 (push, Claude) làm sau 1/11.

**Kiểm thử bắt buộc trước khi qua cổng**

- [ ] Entry qua nửa đêm gán đúng ngày logic (ngủ 01:30, làm việc 23:00–01:00).
- [ ] Ghi offline trên điện thoại, bật mạng, PC thấy trong ≤ 2 phút.
- [ ] Hai máy cùng sửa một Entry → bản mới hơn thắng, không nhân đôi.
- [ ] Token hết hạn giữa chừng → không mất dữ liệu, tự sync lại sau khi đăng nhập.
- [ ] Cài PWA lên màn hình chính điện thoại, mở offline được.
- [ ] Streak đúng với lịch T2–T6 và lịch "3 lần/tuần".
- [ ] Ảnh < 300 KB, giờ Entry = giờ chụp, không có GPS trong file.
- [ ] Engine tương quan qua bộ dữ liệu giả 60 ngày (Module 8).
- [ ] Dashboard < 1 giây với 1 năm dữ liệu giả (\~11.000 Entry).
- [ ] Xoá sạch dữ liệu giả trước 1/11.

## Câu hỏi mở cần Đạt trả lời

**Đã chốt ngày 21/10**

| Chủ đề | Quyết định |
| --- | --- |
| Hướng app | Đồng hồ sinh hoạt → lời khuyên sức khoẻ, công việc, tinh thần. Không liên quan tiền |
| Thiết bị | Chủ yếu điện thoại |
| Nhắc nhở | Phương án A trước, ổn thì lên C |
| Ảnh | Có, nén + tách file (Module 10) |
| Dữ liệu cũ | Không nhập; 21–31/10 làm và test, dùng thật từ 1/11 |
| Claude | Làm nút "Hỏi Claude" trước; API tính sau (8.6) |
| Tên | Nhật ký |

**Còn cần trả lời**

- [ ] **1. Điện thoại iPhone hay Android?** Ảnh hưởng cách cài PWA, push ở phương án C, và đọc giờ chụp ảnh (iPhone hay lưu ảnh dạng HEIC).
- [ ] **3. Giờ cắt ngày 04:00** — xem ví dụ ở Data model, ổn chưa?
- [ ] **4. Giờ làm chuẩn** 8:00–17:30, T2–T6 đúng không? Thứ 7 có đi làm không?
- [ ] **5. Thêm chỉ số nào nữa không**: cân nặng, thời gian dùng điện thoại, ra ngoài trời buổi sáng, đọc sách?
- [ ] **6. Ảnh cũ**: giữ ảnh lớn vĩnh viễn, hay sau 12 tháng chỉ giữ ảnh thu nhỏ?
- [ ] **7. Gói Claude** mày đang dùng là Pro hay Max? Quyết định có làm cách B (API) không.

## Nguồn

- [RxDB — Google Drive replication](https://rxdb.info/replication-google-drive.html): appDataFolder cô lập theo OAuth Client ID; mô hình offline-first sync qua Drive không cần backend.
- [rclone forum — drive.appdata scope](https://forum.rclone.org/t/google-drive-drive-appdata-scope/8295): chỉ đọc được appDataFolder của app khác khi dùng chung client ID.
- [monaco-notepad](https://github.com/Jun-Murakami/monaco-notepad): ví dụ nhiều client cùng project dùng chung appDataFolder.
- [Google Ads API — credential management](https://developers.google.com/google-ads/api/docs/oauth/credential-management): access token Google hết hạn sau 1 giờ.
- [Exist — insights từ dữ liệu Todoist](https://jenny.exist.io/blog/todoist/) và [Measuring Myself with Exist.io](https://ruk.ca/node/22955): tương quan cần vài tháng dữ liệu, app chỉ ra tương quan và để người dùng tự kết luận.
- [RescueTime blog về Exist](https://blog.rescuetime.com/using-personal-data-to-find-worklife-balance/): mục tiêu động theo trung bình cùng thứ trong 90 ngày.
- [Bearable](https://bearable.app/) và [r/BearableApp](https://gummysearch.com/r/BearableApp/): người dùng than mệt vì phải ghi chép và lời khuyên không giúp ra quyết định — lý do cho nguyên tắc 1 và 4.

* [Claude Help Center — gói trả phí và API tính riêng](https://support.claude.com/en/articles/9876003): gói Claude không gồm API; Max và Team có credit API hằng tháng.
