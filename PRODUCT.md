# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Một người dùng duy nhất: Nguyễn Tiến Đạt (dev, 2003). Không có người dùng thứ hai, không chia sẻ, không mạng xã hội.

Dùng chủ yếu trên **iPhone** (PWA thêm vào màn hình chính), thường **một tay, đứng hoặc đi**, ghi nhanh giữa việc. Thỉnh thoảng mở trên PC. Theme sáng/tối theo máy, nên buổi tối trong phòng tối là một ngữ cảnh thật (suy ra từ thói quen ghi giờ ngủ, chưa được Đạt xác nhận riêng).

Việc cần làm: ghi một sự kiện trong ≤ 2 chạm / ≤ 5 giây; cuối ngày chấm ngày trong ≤ 60 giây; sau vài tuần đọc lời khuyên có số liệu.

## Product Purpose

Theo dõi **đồng hồ sinh hoạt**: giờ ngủ, giờ ăn, giờ làm, thói quen, năng lượng, tâm trạng. Từ đó tìm quy luật và đưa lời khuyên về sức khoẻ, công việc, tinh thần.

Thành công đo được (SPEC): ghi một sự kiện ≤ 5 giây; review cuối ngày ≤ 60 giây; sau 4 tuần dữ liệu app chỉ ra ≥ 3 quy luật có số kèm theo; mở được offline, tự sync, dùng chung điện thoại và PC. Dùng thật từ 1/11/2026.

## Positioning

Local-first, dữ liệu nằm trong Google Drive `appDataFolder` của chính Đạt, không có server trung gian. Lời khuyên luôn có số và độ tin cậy; thiếu dữ liệu thì nói "chưa đủ dữ liệu", không bịa. Tương quan không phải nhân quả: app chỉ ra cái đi kèm nhau, Đạt tự quyết thử gì, thí nghiệm để kiểm chứng. Không theo dõi tiền.

## Operating Context

- Ngày logic kết thúc lúc 04:00 sáng hôm sau (`dayStartHour`), múi giờ Asia/Ho_Chi_Minh.
- Việc kéo dài (làm việc, hoạt động, vận động) ghi bằng hai lần bấm: Bắt đầu lưu giờ, Kết thúc lưu giờ. **Không có đồng hồ đếm giờ trên màn hình** (Đạt không bật app liên tục); việc dở nằm trong thẻ "Đang làm".
- Tab Hôm nay chỉ ghi thời gian thực; việc đã làm xong ghi ở tab Ghi bù.
- "Đi ngủ" / "Thức dậy" chỉ cần bấm. "Uống nước" chọn lượng, các lần uống trong ngày gộp thành một dòng.
- 5 tab: Hôm nay, Ghi bù, Thói quen, Thống kê, Cài đặt.
- Offline-first (PWA); đăng nhập Google Identity Services, token sống ≤ 1 giờ, 401 thì xin lại im lặng.
- Triển khai GitHub Pages, `base: '/nhat-ky/'`.

## Capabilities and Constraints

Ràng buộc cứng (từ CLAUDE.md, mọi việc thiết kế phải giữ):

- **Font**: Be Vietnam Pro.
- **Theme**: sáng/tối theo máy (có thể ép trong Cài đặt qua `data-theme`).
- **Biểu đồ**: SVG tự vẽ; không thêm thư viện chart nếu chưa hỏi Đạt.
- **Thông báo**: mọi toast (kể cả "Hoàn tác") và banner đặt ở **phía trên** màn hình, không đặt ở dưới. Đạt đã yêu cầu rõ.
- **Nút chạm** tối thiểu 44px.
- **Mobile-first** 360–430px, thiết kế cho cỡ này trước.
- **Chữ trên UI bằng tiếng Việt**; tên biến, hàm, comment code bằng tiếng Anh.
- **Không thêm dependency** ngoài Vite, TypeScript, Preact, Dexie, vite-plugin-pwa, Vitest mà không hỏi Đạt.
- **Không theo dõi tiền** dưới bất kỳ hình thức nào.
- Mục tiêu tốc độ: ghi một sự kiện ≤ 2 chạm từ màn Hôm nay.
- `null` ≠ 0: ngày không ghi hiển thị là thiếu dữ liệu, không phải 0.
- Không lưu số liệu dẫn xuất; mọi tổng, trung bình, streak tính lại từ Entry + Day.
- Đổi schema dữ liệu đã có dữ liệu thật (sau 1/11), thêm scope OAuth, đổi cấu trúc file Drive: phải hỏi Đạt.

Đang mở / chưa quyết: giờ làm chuẩn (8:00–17:30, T2–T6?), có thêm chỉ số cân nặng / thời gian dùng điện thoại hay không, chính sách giữ ảnh lớn sau 12 tháng, gói Claude (quyết định nút "Hỏi Claude" cách B).

## Brand Commitments

Tên: **Nhật ký**. Giọng văn trong app: tiếng Việt, ngắn, thẳng, xưng "mày/tao" ở tài liệu nội bộ; UI không xưng hô lòng vòng. Token hiện có (kem giấy ấm, nâu ấm, xanh lục đậm làm màu hành động) là hiện trạng của app, chưa được Đạt chốt là bất biến: Đạt thấy UI **lỗi thời** và muốn hiện đại hoá.

## Evidence on Hand

- `docs/SPEC.md`: đặc tả đầy đủ, 10 module.
- `docs/PLAN.md`: danh sách task theo phase.
- Dữ liệu giả để test sinh bởi `src/dev/` (chỉ chạy ở dev). Chưa có dữ liệu thật trước 1/11; không bịa số liệu người dùng, lời chứng thực hay thống kê.

## Product Principles

1. **Nhập nhanh hơn lười.** Nút bấm sẵn, giá trị mặc định, ≤ 2 chạm; thiết kế cho ngón cái một tay.
2. **Bắt đầu ít chỉ số.** 5–7 thứ cốt lõi, còn lại tự thêm dần.
3. **Một nguồn sự thật.** Mọi thứ là bản ghi có thời điểm; số liệu dẫn xuất luôn tính lại.
4. **Nói thật về độ chắc chắn.** Lời khuyên có số và độ tin cậy; thiếu dữ liệu thì nói thiếu.
5. **Dữ liệu là của Đạt.** Local-first, xuất được JSON/CSV, không phụ thuộc app khác.

## Accessibility & Inclusion

Nút chạm ≥ 44px. Tương phản chữ đạt WCAG AA ở cả hai theme. Tôn trọng `prefers-reduced-motion`. Tôn trọng `prefers-color-scheme`. Một tay trên iPhone: tính đến safe-area và thanh Home.
