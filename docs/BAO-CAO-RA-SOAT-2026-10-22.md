# Báo cáo rà soát Nhật ký — 22/10/2026

File này viết để dán sang đoạn chat khác làm tiếp. Đọc `CLAUDE.md`, `docs/SPEC.md`, `docs/PLAN.md` trước. Đạt nói chuyện kiểu tao/mày, thích trả lời thẳng, không khen xã giao.

Mốc: `main` tại `673a382` (đã gồm PR #25 màn Quản lý ghim, #26 nút nhanh chọn danh mục, #27 sửa ô giờ/thanh nút/thứ tự "Đã ghi"). Lint, tsc, 404 test, build đều xanh.

## 1. Cách rà soát và độ tin cậy

Ba bên rà soát độc lập, chỉ đọc, không sửa repo: (A) logic core/sync, (B) chất lượng code, bảo mật, hiệu năng, (C) UI/UX chụp và xem ảnh trong Chromium 360/390/430px, sáng và tối.

Mỗi mục ghi mức chắc chắn:
- **[đã kiểm]** người viết báo cáo này đọc lại code và xác nhận.
- **[đọc code]** bên rà soát xác minh bằng đọc code, chưa kiểm lại.
- **[chạy thử]** bên rà soát chạy được ví dụ tái hiện.
- **[thấy ảnh]** thấy trong ảnh chụp Chromium.
- **[nghi]** chưa xác minh.

Chromium **không** tái hiện được lỗi riêng của iOS Safari (ô time/date, bàn phím, safe-area, hoạt ảnh). Mọi thứ về iPhone ở mục 5 là chưa kiểm.

## 2. Nhóm A — Logic và dữ liệu (làm trước)

### A1. [CAO] [đã kiểm] Sync đầu tiên có thể ghi đè bản thật trên Drive bằng defs/settings mặc định
- Chỗ: `src/data/seed.ts`, `src/data/repository.ts` (`saveDefs`, `saveSettings`), `src/sync/engine.ts` (`syncDoc`).
- Kịch bản: máy mới, chọn "Dùng ngay, đăng nhập sau". Seed có `updatedAt` = epoch và `dirty: 0`. Sửa một thói quen hoặc cài đặt thì `saveDefs` ghi toàn bộ defs mặc định với `dirty: 1` và `updatedAt` mới. Đăng nhập xong, `syncDoc` thấy local mới hơn nên ghi đè `nk_defs.json` thật. Máy kia kéo về và mất thói quen, danh mục, nút nhanh.
- Cùng cơ chế: hai máy sửa defs ở hai chỗ khác nhau, máy `updatedAt` muộn hơn xoá thay đổi của máy kia (merge theo cả file, không theo từng phần tử).
- Hướng sửa: lần sync đầu mà local chỉ có seed và remote có dữ liệu thì remote thắng; cân nhắc merge defs theo từng phần tử (`id`) thay vì cả file. Cần test. Đây là thay đổi hành vi sync, hỏi Đạt trước.

### A2. [VỪA] [đọc code] Khôi phục sao lưu và kéo từ Drive không kiểm tra hình dạng bản ghi
- `src/backup/snapshot.ts` (`parseSnapshot` chỉ kiểm `version` và `Array.isArray`, `restoreSnapshot` ghi thẳng), `src/sync/engine.ts:68-90`.
- File hỏng hoặc `updatedAt` ở tương lai xa (vd 9999) vào IndexedDB rồi lên Drive, thắng merge mãi, có thể làm trắng màn Hôm nay.
- Hướng sửa: hàm thuần `isEntry`/`isDay` trong `core/` (kiểu, `id`, regex `dateKey`, ISO hợp lệ, chặn `updatedAt` > now + 1 ngày), bỏ bản ghi hỏng và báo số bị bỏ; thêm test.

### A3. [VỪA] [đọc code] Tương quan lag 0 ghép chỉ số giấc ngủ của "đêm bắt đầu ngày d" với kết quả của chính ngày d
- `src/core/correlation/engine.ts:188-196`; các metric `bedtime`, `sleep_hours`, `sleep_midpoint`, `bedtime_sd7`, `screen_before_bed`, `last_meal_to_bed`, `last_coffee_to_bed`, `late_eating`.
- Điểm ngày và tâm trạng của ngày d được chấm **trước** khi ngủ, nên nhân quả ngược. Có thể sinh insight sai chiều, kéo theo `action` và thí nghiệm sai. SPEC 8.3 chỉ cho giấc ngủ ghép lag 1.
- Còn nợ cũ: tương quan lẫn yếu tố ngày thường/cuối tuần (đã ghi trong tài liệu, chưa sửa).

### A4. [VỪA] [đọc code] "Đi ngủ"/"Thức dậy" không giới hạn thời lượng
- `src/data/sleep.ts:35-58`, `src/core/sleep.ts:32-45` (`maxHours = 24`).
- Quên bấm Thức dậy lúc 07:00; tối 22:30 bấm "Đi ngủ" thì bị từ chối; sáng hôm sau bấm Thức dậy đóng entry cũ thành ~32h. `sleep_hours`, `bedtime`, insight sai. `finishPatch` có trần 16h nhưng đường sleep không dùng.

### A5. [VỪA] [chạy thử] `habit_rate` và `habit:<id>` không trả `null` ở ngày chưa ghi gì (vi phạm luật null ≠ 0)
- `src/core/metrics/definitions.ts:400-411`, `:441-451`.
- Ngày không có entry: thói quen quit luôn "đạt", build luôn "trượt" (`habit_rate = 0.5`). Kéo trung bình tuần và các cặp tương quan.
- Liên quan: `dayStatus` coi thói quen quit/`<=` là đạt ở ngày chưa ghi (có chú thích là cố ý) nên streak của thói quen quit tăng cả khi không mở app. Hỏi Đạt có chủ ý không.

### A6. [VỪA] [chạy thử] `copyToDay` làm khối vắt qua `dayStartHour` có `end < start`
- `src/core/entryForm.ts:60-64`. Làm việc 02:00→05:00 chép sang ngày khác cho `start = …-23T02:00`, `end = …-22T05:00`. Hàm này không dùng `resolveEnd` như form.

### A7. [VỪA] [chạy thử] `completionRate` của thói quen "x lần/tuần" tính sai
- `src/core/habits.ts:171-176`: đếm mọi ngày đạt rồi chia `times × days / 7`, không đếm theo tuần. Ví dụ "3 lần/tuần", làm 7 lần tuần đầu rồi bỏ 3 tuần: 58% dù chỉ 1/4 tuần đạt.

### A8. [VỪA] [đọc code] Chuỗi thói quen bị cắt theo cửa sổ nạp 120 ngày
- `src/ui/screens/Habits.tsx:23,32` [đã kiểm]. Streak dài hơn 120 ngày hiện tối đa ~120, "tỷ lệ" cũng chỉ trong cửa sổ. Sửa: nạp từ `habit.startDate`, hoặc ghi rõ "trong 120 ngày". Hỏi Đạt có chủ ý không.

### A9. [VỪA] [đọc code] Token bị xoá khi chỉ mất mạng; 401 lần hai hiện "error" thay vì "Đăng nhập lại"
- `src/auth/token.ts:92-96` [đã kiểm]: `.catch` gọi `forget()` với **mọi** lỗi, kể cả `AuthNetworkError`. Chỉ nên `forget()` khi `AuthRequiredError`. Kiểm `token.test.ts` có phủ trường hợp này không.
- `src/drive/client.ts:33-45`, `src/sync/engine.ts:213-224`: 401 lần hai ném `DriveError(401)` nên trạng thái là `error`, trái CLAUDE.md ("thất bại mới hiện Đăng nhập lại").
- `signIn()` trả luôn promise của yêu cầu im lặng đang treo (timeout 15s) nên bấm nút có thể không mở popup trong ≤15 giây.
- `src/sync/engine.ts:218`: mọi `TypeError` bị coi là offline, che lỗi lập trình.

### A10. [VỪA] [đọc code] Metric dùng `clockHours` sai cho giờ sau nửa đêm trước `dayStartHour`
- `last_coffee_time`, `dinner_time`, `work_start_time` (`definitions.ts:190-196, 236-242, 343-349`) và rule `late_coffee` (`rules.ts` ~102). Cà phê lúc 01:00 (thuộc ngày logic trước) ra 1.0 = "uống sớm", rule "cà phê muộn" không bắn. `nightHours` đã xử lý đúng cho giờ ngủ nhưng các metric này không dùng.

### A11. [THẤP–VỪA] [đọc code] `payload.isOvertime` là số liệu dẫn xuất lưu cứng (vi phạm luật #8)
- `src/data/repository.ts:23-35`, metric `overtime_hours`. Chỉ tính lúc tạo/sửa; đổi `workStart/workEnd/workDays` thì entry cũ không đổi theo; entry nhập CSV và khối chưa kết thúc không có cờ nên `overtime_hours` = 0. Sửa bằng cách tính lại từ Entry + Settings trong metric.

### A12. [THẤP] [đọc code]
- Lớp `data/` không kiểm `end > start` hay độ dài tối đa (`createEntry`, `updateEntry`).
- `saveSettings`, `saveDefs`/`upsertHabit`, `saveInsightStore` đọc rồi ghi không nguyên tử; hai lần gọi gần nhau mất patch của lần trước.
- `social_jetlag` lấy đêm T7 và CN làm "cuối tuần" (`weekday(k) >= 5`); SPEC dòng 332 ghi "T7–CN" mơ hồ. Theo CLAUDE.md đây là mâu thuẫn cần hỏi Đạt, không tự sửa.

## 3. Nhóm B — Code, kiến trúc, hiệu năng

Tốt: `src/core` không import Preact/Dexie/fetch/localStorage; UI không gọi Drive; không có `innerHTML`/`dangerouslySetInnerHTML`/`eval`; không có secret (chỉ clientId public); token `nk_tok_v1` đúng thiết kế; `DevPanel`/`dev` không lọt vào bundle prod; `npm audit --omit=dev` 0 lỗ hổng; bundle JS 300 kB (gzip 100 kB).

Hiệu năng [đã đo, dữ liệu giả 730 ngày = 16.490 entry]: tạo context 11 ms, tính mọi metric 98 ms, tương quan 182 ms. Chưa có vấn đề.

Cần làm:
- **B1 [VỪA, đọc code, đã kiểm] Cập nhật PWA có thể kẹt bản cũ.** `registerType: 'prompt'`; trạng thái `available` chỉ hiện trong Cài đặt → Ứng dụng, `App.tsx` không thông báo. Hướng sửa: chip/toast "Có bản mới — Cập nhật" ở màn chính, hoặc tự cập nhật khi không có form mở.
- **B2 [THẤP, đọc code]** `useLive` nuốt lỗi (`src/ui/useLive.ts:8`): truy vấn lỗi thì màn trắng vĩnh viễn. Trả thêm `error` và hiện thông báo chung.
- **B3 [THẤP, đọc code]** `getRunningEntries` quét toàn bảng (`repository.ts:137-139`), chạy lại mỗi lần bảng đổi; `Today.tsx` có 9 `useLive` riêng lẻ. Chưa đau ở 16k entry; thêm index cần đổi schema nên phải hỏi/migration.
- **B4 [THẤP, đọc code]** Hàm/file dài: `Today()` ~337 dòng, `Habits()` ~272, `ManageDefs.tsx` 574, `EntryForm.tsx` 422, `charts.tsx` 400. Gợi ý tách có chủ đích: hook `useTodayData`, `habitRow` thành hàm thuần có test trong `core/habits.ts`, tách editor trong `ManageDefs`.
- **B5 [THẤP, đọc code]** Trùng lặp: `shiftMonth` ở `stats/Overview.tsx:153` và `stats/Health.tsx:11` (nên là `addMonths` trong `core/date.ts`), `HISTORY_DAYS` khai báo ở 3 nơi với giá trị khác nhau (97 / 120 / 180), `mean()` định nghĩa lại ở 5 nơi (3 bản chia 0 ra NaN, 2 bản trả null), màu mặc định hard-code ở 3 nơi (`#6c6c70`, `#3b4a9e`).
- **B6 [THẤP, đọc code]** Sync/restore get từng bản ghi trong vòng lặp (nên `bulkGet`). Thiếu test cho `snapshot.ts`/`importCsv.ts` với dữ liệu hỏng.
- **B7 [ghi nhận, không sửa]** Khoá phóng to (chủ ý), khoá app chỉ chặn UI bằng WebAuthn và không mã hoá IndexedDB (đúng thiết kế).

## 4. Nhóm C — UI/UX

Đo tự động 14 màn ở 360/390/430px: không tràn ngang; không nút icon nào thiếu `aria-label`. 

Đã thấy tận mắt, xếp theo mức độ:

1. **[CAO] [thấy ảnh] Ghi từ Hôm nay mất 3 chạm** (chọn nút → chọn danh mục → form đầy đủ → lưu), trái luật ≤ 2 chạm. Chỉ Uống nước đạt 2 chạm. Đề xuất: chọn danh mục xong ghi ngay (giờ = bây giờ) kèm toast "Sửa / Hoàn tác"; việc kéo dài thì chọn danh mục = bắt đầu chạy. **Cần Đạt quyết** vì có thể chủ ý.
2. **[CAO, cần kiểm lại] Nút lưu ghi "Bắt đầu" cả với bữa ăn.** Bên rà soát báo bấm xong lưu thành bản ghi tức thời; code `EntryForm.tsx:403` là `startsBlock ? 'Bắt đầu' : 'Lưu'`. Cần xác minh `startsBlock` với loại `meal`, và hành vi thật (chạy tiếp hay tức thời).
3. **[CAO] [đã kiểm một phần] Nút chạm < 44px**: `.btn.small` 36px (`style.css:215`), `.pills button` 40px, công tắc luật cảnh báo 52×32, nút trạng thái đồng bộ ở topbar cao ~17px. Đặt `min-height: 44px` cho các lớp đó.
4. **[CAO] [thấy ảnh] Ô lịch tháng chữ không đọc nổi ở cực trị** cả sáng lẫn tối (chữ cố định, nền `color-mix`), không có chú giải thang màu. Đổi màu chữ theo độ sáng nền, thêm chú giải, bấm ô xem giá trị.
5. **[VỪA–CAO] [thấy ảnh] "Đồng bộ ngay" khi chưa đăng nhập không phản hồi gì**; còn nút đỏ "Đăng xuất" dù chưa đăng nhập, và không có nút "Đăng nhập". Liên quan A9.
6. **[VỪA–CAO] [đã kiểm] Sheet không phải dialog đúng nghĩa**: không `role="dialog"`/`aria-modal`, không đóng bằng Esc, không bẫy focus, không nút đóng hiện.
7. **[VỪA] [đã kiểm] Toast ở trên cùng** (`top: calc(68px + safe-area)`), đè thanh chọn ngày, xa ngón cái. Đặt phía trên tab bar.
8. **[VỪA] [thấy ảnh] So sánh tuần dễ hiểu sai**: mũi tên % không màu tốt/xấu; phần trăm trên thang 1–5 hoặc giờ trong ngày vô nghĩa ("Giờ đi ngủ ↑3%"); thẻ thiếu thang "/5", "/10". Đổi thành chênh lệch tuyệt đối ("+0,4 điểm", "+24 phút") và tô màu theo chiều tốt/xấu từng chỉ số.
9. **[VỪA] [thấy ảnh] Biểu đồ thiếu trục, giá trị, chú giải**: "Xu hướng 90 ngày" dồn ở bên phải khi ít dữ liệu; cột theo thứ không có giá trị; cột chồng ở "Thời gian" không chú giải, hai màu xanh khó phân biệt.
10. **[VỪA] [đã kiểm một phần] Chữ tiếng Anh lọt vào UI**: "Stress" (`ReviewSheet.tsx:86`), "Tự tick" (`HabitForm.tsx:110`), "Streak sắp đứt", "Tick ngay ở đây", "OT", "TB", "Entry" trong câu trạng thái rỗng của Tag. Gợi ý: "Căng thẳng", "Tự đánh dấu", "Chuỗi ngày sắp đứt", "Giờ tăng ca", "Trung bình", "bản ghi".
11. **[VỪA] [thấy ảnh] Thang 1–5 / 1–10 không giải nghĩa** (Tâm trạng, Năng lượng, Stress, Tập trung, Điểm cả ngày). Thêm nhãn hai đầu; riêng Stress nói rõ chiều.
12. **[VỪA] [thấy ảnh] HabitForm có 7 nhóm lựa chọn** để thêm một thói quen. Chỉ hiện Tên + Lịch + Nhắc, gập phần còn lại vào "Tuỳ chọn nâng cao"; thêm placeholder ví dụ.
13. **[THẤP–VỪA]** "Giá trị / Đơn vị" ở mọi form là chung chung; form dài tới 3 màn hình ở 360px. Ẩn trừ loại có ý nghĩa số.
14. **[THẤP–VỪA]** Khoảng cách: thẻ thiếu dữ liệu sát thẻ "Xu hướng 90 ngày"; sheet "Thêm" chỉ ghi "Thêm" (nên "Thêm nút nhanh"), nhãn "Danh mục hiện khi bấm nút" dính chip đầu (đây là phần mới của PR #26).
15. **[THẤP–VỪA]** Pills tab con xuống dòng không đều (3+2, 3+3); comment trong `Pills.tsx` nói "một hàng cuộn ngang" nhưng CSS là `flex-wrap`.
16. **[THẤP–VỪA]** Chữ cam "Chưa đăng nhập, dữ liệu chỉ lưu trên máy" 11,5px, tương phản ≈ 4,0:1, và là gần như nút duy nhất để đăng nhập khi đã bỏ qua màn Login.
17. **[THẤP]** Chip trên Hero (Ngủ, Sáng, Trưa, Tối…) giống nút nhưng không bấm được; "Mục cốt lõi" khó hiểu; thẻ "Đang làm" nên lên đầu; lịch tháng và 6 chỉ số tuần lặp ở hai tab; dòng thói quen không có dấu hiệu bấm được; "Ngân sách tuần này" dễ nhầm với tiền (đổi "Mục tiêu giờ tuần này"); nút "+10'" có `aria-name` "Thêm".
18. **[THẤP]** Đơn vị trộn ("15p", "+10'", "20 phút", "1h16"); "Đổi" trong báo cáo nên là "Thay đổi"; 10 dòng luật cảnh báo lặp "Bấm để chỉnh ngưỡng"; khoá app dùng công tắc phân đoạn khác công tắc trượt ở nơi khác; ba nút "Bắt đầu −15p/−30p/−1h" dễ nhầm với nút lưu "Bắt đầu"; hai ô giờ ở trang Mục tiêu lệch lề.
19. **[THẤP]** Mũi tên lịch ◀ ▶ trong Thống kê khác chevron của DateNav; nhãn tab bar 11,2px nhỏ.

## 5. Chưa kiểm — cần Đạt thử trên iPhone thật
- Ô giờ/ngày trong sheet có hết tràn sau PR #27 không (đã thêm `appearance: none` kiểu iOS, nhưng Chromium không tái hiện lỗi gốc).
- Bàn phím ảo che nút Lưu/Huỷ ở đáy sheet khi nhập tag/ghi chú; home indicator đè nút Lưu.
- Khoá phóng to; hoạt ảnh sheet có giật không; cuộn nền khi sheet mở; màn Quản lý khi bàn phím hiện.
- Face ID ở màn khoá. Sheet khôi phục JSON/CSV và ảnh chưa được mở khi rà.
- Chưa rà từng sheet ở các tab Ghi bù, Thói quen, Cài đặt cho lỗi ô giờ/thanh nút theo cách từng cái một (script tự động chỉ phủ các sheet ở Hôm nay).

## 6. Thứ tự làm đề xuất (mỗi đợt một PR, test trước, lint + test + build trước khi mở PR)

**Đợt 1 — an toàn dữ liệu (cần Đạt đồng ý hành vi sync):** A1, A2, A4, A9, rồi B1 (báo bản mới) để các bản sửa tới được máy.

**Đợt 2 — số liệu đúng:** A5, A7, A8, A10, A6, A11; rồi A3 (giấc ngủ lag 1) kèm sửa confound ngày thường/cuối tuần nếu Đạt muốn.

**Đợt 3 — UX nhanh, ít rủi ro:** mục 3 (44px), 6 (dialog/Esc), 7 (toast), 4 (lịch), 10 (chữ Việt), 11 (nhãn thang), 5 (đăng nhập), 14, 15, 16.

**Đợt 4 — cần Đạt quyết trước:** mục 1 (ghi 2 chạm, hoàn tác), 2, 8, 9, 12, 13, 17.

**Đợt 5 — dọn code khi tiện:** B2–B6.

## 7. Câu hỏi cần Đạt trả lời trước khi làm
1. Sync lần đầu: remote luôn thắng nếu local chỉ có seed, và merge defs theo từng phần tử — đồng ý không?
2. Streak thói quen > 120 ngày: sửa cho đúng hay chủ ý chỉ xem 120 ngày?
3. Thói quen quit/`<=` ngày chưa ghi gì: tính "đạt" (hiện tại) hay "chưa có dữ liệu"?
4. Ghi từ Hôm nay: chuyển sang ghi ngay + toast Hoàn tác (2 chạm), hay giữ form đầy đủ?
5. `social_jetlag`: cuối tuần là đêm T7–CN hay đêm T6–T7?
6. Có migration chuyển entry cũ "activity" sang "Học tập" cho các danh mục đã đổi loại không?

## 8. Ghi chú cho người làm tiếp
- Luật cứng: một `toDateKey`; không lưu số liệu dẫn xuất; `null` ≠ 0; xoá mềm; không tiền; thay schema đã có dữ liệu thật phải hỏi và có migration; không thêm dependency.
- Mỗi task xong tick `docs/PLAN.md` cùng commit (T7.8–T7.10 là mới nhất).
- Trước mỗi PR chạy **cả ba**: `npm run lint` (toàn repo), `npm run test`, `npm run build` — Deploy chạy đúng ba bước này (PR #21 và #22 từng fail vì lint).
- Chạy dev bằng Playwright: tránh `pkill -f` (từng giết chính shell); dùng PID file.
- Đạt thường yêu cầu "vào PR mới" cho mỗi đợt; không tạo PR nếu chưa được bảo.
