# Kịch bản nghiệm thu trên máy thật (T8.7 / T3.7)

Phần này cần iPhone, PC và tài khoản Google thật, nên Claude không tự chạy được. Mỗi bước có cách làm và kết quả phải thấy. Làm xong bước nào thì ghi kết quả vào cột cuối, rồi tick dòng tương ứng ở "Checklist nghiệm thu" trong `PLAN.md`.

Trước khi làm:
- Bản mới đã deploy lên Pages. Mở Cài đặt → Ứng dụng → "Kiểm tra bản mới" trên cả hai máy cho tới khi báo "Đang dùng bản mới nhất".
- Cả hai máy đăng nhập cùng tài khoản Google.
- Tải một file sao lưu: Cài đặt → Dữ liệu → Xuất JSON, để lỡ có gì còn khôi phục được.

| # | Kiểm | Cách làm | Phải thấy | Kết quả |
| --- | --- | --- | --- | --- |
| 1 | Cài PWA, mở offline | iPhone Safari → Chia sẻ → Thêm vào MH chính. Mở app một lần, bật Chế độ máy bay, đóng hẳn app, mở lại | App mở được, chữ đúng font Be Vietnam Pro, Hôm nay hiện dữ liệu | |
| 2 | Lưu trữ bền | Cài đặt → Dữ liệu → Lưu trữ trên máy | "Lưu trữ bền: Có". Nếu "Không rõ"/nút "Xin lại", bấm rồi ghi lại kết quả | |
| 3 | Ghi offline rồi sync | Vẫn chế độ máy bay: ghi "Uống nước 250 ml". Cài đặt → Ứng dụng: "Chờ đẩy lên Drive" ≥ 1. Tắt chế độ máy bay, mở lại app | Trong ≤ 2 phút: "Chờ đẩy lên Drive: 0 mục"; PC (mở lại tab) thấy lần uống nước đó | |
| 4 | Hai máy sửa cùng một mục | Trên PC tắt mạng, sửa tiêu đề mục ở bước 3 thành "PC". Trên iPhone sửa thành "iPhone" (làm sau). Bật mạng PC, đồng bộ cả hai | Cả hai máy cùng hiện "iPhone" (bản sửa sau thắng), không có mục nhân đôi | |
| 5 | Token hết hạn giữa chừng | Trên PC, DevTools → Application → Local Storage → `nk_tok_v1`: sửa `exp` thành một số nhỏ (vd `1`). Ghi một mục, bấm "Đồng bộ ngay" | Hoặc tự lấy token mới im lặng và đồng bộ được, hoặc hiện "Đăng nhập lại"; mục vừa ghi vẫn còn, đăng nhập lại xong thì lên Drive | |
| 6 | Qua 04:00 khi app treo nền | Tối mở app rồi khoá máy, không đóng app. Sáng hôm sau mở lại | Hôm nay đã là ngày mới, có thẻ Giấc ngủ với nút "Thức dậy" (lỗi B1 đã sửa) | |
| 7 | Bấm đúp | Bấm đúp thật nhanh "Đi ngủ", sáng bấm đúp "Thức dậy" | Chỉ một giấc ngủ trên timeline | |
| 8 | Ảnh iPhone | Ghi bữa ăn, thêm ảnh chụp bằng camera (HEIC) và một ảnh "Tương thích nhất" (JPEG) | JPEG: giờ bữa ăn = giờ chụp. HEIC: hoặc được, hoặc báo lỗi rõ ràng bằng tiếng Việt, không treo | |
| 9 | Khoá app (Face ID) | Cài đặt → Ứng dụng → Khoá khi mở app → Bật. Ra màn hình chính 3 phút, mở lại | Hỏi Face ID; mở được | |
| 10 | Đăng nhập trên Pages có CSP | Đăng xuất, đăng nhập lại | Hiện cửa sổ chọn tài khoản Google, đăng nhập xong sync chạy; Cài đặt → Ứng dụng → Nhật ký lỗi không có dòng mới | |
| 11 | Dữ liệu giả đã xoá trên Drive | Mở trên máy mới (hoặc Safari riêng tư) → đăng nhập → đợi sync | Không có mục nào trước 1/11/2026 (tháng 10 là dữ liệu giả) | |
| 12 | Tốc độ trên iPhone | Mở app từ màn hình chính (đã mở trước đó) | Thấy Hôm nay dùng được trong khoảng 1 giây. Chậm rõ thì báo để làm tách chunk (T10.6) | |

Nếu bước nào hỏng: Cài đặt → Ứng dụng → Nhật ký lỗi → "Chép nhật ký", dán cho Claude kèm số bước.
