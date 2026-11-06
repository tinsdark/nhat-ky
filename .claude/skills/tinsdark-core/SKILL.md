---
name: tinsdark-core
description: Quy trình làm việc bắt buộc của Đạt cho mọi repo. Dùng ở đầu mọi task code (tính năng mới, sửa lỗi, refactor, tối ưu) trong repo có skill này. Quyết định task thuộc cỡ nào và gọi các skill core theo đúng thứ tự - làm rõ, plan, làm, verify, review, chốt bài học. Không dùng cho câu hỏi thuần, hoặc khi user chỉ nói "đọc"/"check".
---

# Tinsdark core

Quy trình chung cho mọi repo của Đạt. Các skill được gọi ở đây nằm cùng thư mục `.claude/skills/` (pack `core`). Thiếu skill nào → nói rõ thiếu, làm tiếp theo mô tả ở bảng dưới, không bịa nội dung skill.

## Nguyên tắc (luôn áp dụng)

1. **Nghĩ trước khi code.** Nêu giả định. Có nhiều cách hiểu → hỏi, không tự chọn im lặng.
2. **Đơn giản trước.** Code tối thiểu giải quyết đúng yêu cầu. Không thêm tính năng, abstraction, cấu hình không ai yêu cầu.
3. **Sửa đúng chỗ.** Chỉ đụng dòng cần đụng, giữ style hiện có. Thấy code chết không liên quan → nói, không xoá.
4. **Có tiêu chí xong.** Mỗi task có điều kiện kiểm chứng được; chưa có bằng chứng thì chưa báo xong.
5. **Báo cáo thật.** Test fail thì nói fail kèm output. Bỏ bước nào thì nói bỏ.
6. **Chỉ rõ chỗ sửa.** Báo cáo luôn ghi `file:dòng` đã đổi.

## Bước 0 — Xếp cỡ task

| Cỡ | Dấu hiệu | Quy trình |
|---|---|---|
| **Nhỏ** | Sửa 1 lỗi rõ ràng, đổi vài dòng, 1 file | `surgical-patch` → `verification-before-completion` |
| **Vừa** | 1 tính năng hoặc lỗi chưa rõ nguyên nhân, vài file | `ce-plan` (bản ngắn) → `ce-work` → `verification-before-completion` → `ce-code-review` (`ce-work` tự gọi `ce-simplify-code` khi diff ≥ 30 dòng code) |
| **Lớn** | Yêu cầu còn mơ hồ, nhiều phần, nhiều file / module, hoặc làm lâu | Đủ 6 bước bên dưới |

Không chắc cỡ nào → chọn cỡ lớn hơn và nói với user.
Lỗi chưa rõ nguyên nhân ở bất kỳ cỡ nào → `ce-debug` trước khi sửa.

## Quy trình đầy đủ (cỡ lớn)

| # | Bước | Skill | Ra được gì |
|---|---|---|---|
| 1 | Làm rõ | `ce-brainstorm` | Yêu cầu rõ ràng, phạm vi, cái gì KHÔNG làm. Hỏi user khi còn mơ hồ |
| 2 | Plan | `ce-plan` | Plan có từng bước + cách verify từng bước |
| 3 | Làm | `ce-work` + `unlazy` | Code theo plan. `unlazy`: viết acceptance gate trước, không dừng giữa chừng |
| 4 | Giữ gọn | `ponytail`, `surgical-patch` | Thay đổi nhỏ nhất đủ giải quyết, không lan ra ngoài phạm vi |
| 5 | Dọn + verify + review | `ce-simplify-code` (diff ≥ 30 dòng) → `verification-before-completion` → `ce-code-review` | Chạy check thật, có output làm bằng chứng; review diff |
| 6 | Chốt bài học | `ce-compound` | Lỗi / điều không hiển nhiên vừa gặp → biến thành test, rule, hoặc ghi chú repo |

Bước 6 chỉ làm khi thật sự có bài học. Không có thì bỏ, và nói là bỏ.

## Không làm

- Không gọi `lfg` hay tự push / mở PR nếu user chưa bảo.
- Không commit thay user nếu repo hoặc user không yêu cầu.
- Không kéo thêm pack khác khi chưa hỏi. Cần pack theo loại sản phẩm → dùng `tinsdark-picker` (nằm trong repo tinsdark-skills).
