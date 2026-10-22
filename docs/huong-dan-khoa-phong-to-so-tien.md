# Hướng dẫn: khoá phóng to cho Sổ Tiền

Làm giống Nhật ký (PR #24 của `tinsdark/nhat-ky`) cho repo `tinsdark/so-chi-tieu`. File này viết sau khi đọc code Sổ Tiền (commit `c9e9668`, chỉ đọc), nên các số dòng và tên file đúng với repo đó. Không có gì ở đây đã được chạy thử trong Sổ Tiền.

## 1. Hiện trạng của Sổ Tiền

| Hạng mục | Hiện có | Ghi chú |
| --- | --- | --- |
| Meta viewport (`index.html` dòng 5) | `width=device-width, initial-scale=1` | Chưa khoá. |
| Ô nhập chữ 16px | Đã có, `style.css` dòng 343, trong `@media (max-width:700px)` | Không phải làm lại phần "iOS tự phóng khi bấm ô nhập". |
| `touch-action` toàn trang | Chưa có | Chỉ có cục bộ: `.bd-lc` là `pan-y`, vài nút là `manipulation`. |
| Chặn `gesturestart` | Chưa có | |
| Cử chỉ tự viết | Có, trong `js/motion.js`: vuốt một ngày ở Sổ tay, kéo xuống để làm mới | Cả hai dùng một ngón (`touches.length !== 1`). |
| Ép khung nhìn | `canKhungNhin()` trong `js/ui.js`, biến `--vv-top` / `--vv-h` | Theo README, có sẵn vì trên iOS khung layout có lúc lệch so với phần nhìn thấy. |

Vậy việc cần làm là ba chỗ: meta, một khối CSS, ba dòng JS. Cộng thêm quy trình bắt buộc của repo (bump, nhật ký cập nhật, test).

## 2. Thay đổi cần làm

### 2.1 `index.html` (dòng 5)

Thay dòng:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

bằng:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

Không thêm `viewport-fit=cover`: nó đổi cách hiển thị dưới tai thỏ và thanh home, không liên quan tới việc khoá phóng to.

### 2.2 `style.css`: thêm khối mới ngay sau khối 16px ở dòng 341–344

```css
/* Khoá phóng to: chỉ cuộn, không véo hay chạm đúp để zoom (app một người dùng, chỉ dùng trên điện thoại).
   touch-action ở html áp cho mọi phần tử con; quy tắc cục bộ như .bd-lc{touch-action:pan-y} chỉ hẹp thêm, không phá. */
html{touch-action:pan-x pan-y;-webkit-text-size-adjust:100%}
```

Không dùng mã màu, nên không đụng quy ước "mọi màu lấy từ biến".

### 2.3 JS: thêm vào đầu `js/ui.js` (hoặc đầu `js/app.js`), cùng kiểu ES5 của repo

```js
/* Khoá phóng to trên iOS Safari: nó bỏ qua cờ viewport (vì trợ năng) nhưng vẫn tôn trọng việc chặn các sự kiện này. */
['gesturestart', 'gesturechange', 'gestureend'].forEach(function(t){
  document.addEventListener(t, function(ev){ ev.preventDefault(); });
});
```

Đặt ở phạm vi ngoài cùng của file, đừng bọc trong hàm chờ `DOMContentLoaded`, để chặn ngay từ đầu. Test của repo kiểm "không trùng tên toàn cục giữa các file": đoạn này không khai báo biến toàn cục nào nên không vi phạm.

### 2.4 Quy trình bắt buộc theo README mục 3

```bash
node tools/bump.js           # sau khi sửa style.css / js, để cập nhật ?v=hash trong index.html
node tests/run-tests.js      # phải 0 fail
node tools/bump.js --check
```

Thêm **một mục lên đầu `NHAT_KY` trong `js/phienban.js`** (mỗi PR làm đổi thứ người dùng thấy đều phải có). Gợi ý, đổi `ban` và `ngay` theo ngày thật khi làm (nếu cùng ngày với bản đã có thì thêm `.2`, `.3`):

```js
{ ban: '2026.10.22', ngay: '2026-10-22', ten: 'Khoá phóng to',
  muc: ['Không còn véo hay chạm đúp để phóng to trang. Ô nhập vẫn không tự phóng khi bấm vào.'] },
```

`VERSION` trong `sw.js`: **không cần tăng**. File của app tải "mạng trước" nên `index.html` mới được lấy ngay khi có mạng. Chỉ tăng (`v5` thành `v6`) nếu muốn ép mọi máy xoá cache cũ.

## 3. Điều cần kiểm riêng ở Sổ Tiền

1. **Vuốt một ngày ở Sổ tay (`motion.js`).** `pan-x pan-y` vẫn cho kéo ngang và dọc, nên cử chỉ này không bị chặn. Thử vuốt trái và phải cho "Xoá" / "Sửa", rồi thử cuộn dọc ngay trên hàng đó.
2. **Kéo xuống để làm mới.** Cùng lý do, vẫn chạy; thử một lần ở đầu trang.
3. **Biểu đồ `.bd-lc`** (đường, `touch-action: pan-y`). Tổ hợp với `html` vẫn là `pan-y`, không đổi.
4. **Lớp phủ toàn màn hình dùng `--vv-top` / `--vv-h`.** Khoá phóng to chỉ làm khung nhìn bớt lệch, không làm hỏng; thử mở bảng trượt khi bàn phím hiện.
5. **Vùng chạm 44px** (`@media (pointer:coarse)`, `::after`): không đổi, không cần đo lại.

## 4. Cách kiểm tra

Trên máy tính, với trình duyệt giả lập điện thoại (Chrome DevTools hoặc Playwright, cổng `http://localhost:8080`, không dùng `file://`):

```js
// chạy trong console của trang
({
  meta: document.querySelector('meta[name=viewport]').content,
  touchAction: getComputedStyle(document.documentElement).touchAction,   // mong đợi 'pan-x pan-y'
  gesturePrevented: (() => { const e = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e); return e.defaultPrevented })(), // mong đợi true
})
```

Trên iPhone thật (phần quyết định, máy tính không thay được):

1. Mở tab Safari thường, véo hai ngón. Có thể **vẫn phóng được**: iOS cố ý cho phóng vì trợ năng, và các lớp trên không phải lúc nào cũng thắng ở tab thường.
2. Cài vào màn hình chính, mở như app, véo hai ngón và chạm đúp. Đây là chỗ cần chặn được.
3. Bấm vào một ô nhập: trang không được tự phóng.
4. Xoay ngang rồi dọc, mở bảng trượt, mở bàn phím: bố cục không lệch.

## 5. Đánh đổi

- Người cận thị không phóng to chữ được. Chấp nhận được với app một người dùng; nếu sau này có người khác dùng thì nên bỏ.
- Trong tab Safari thường iOS có thể vẫn cho phóng (xem mục 4). Khoá chỉ đáng tin khi cài vào màn hình chính.
- Sau khi merge, vào Cài đặt kiểm tra bản mới để máy lấy `index.html` mới.

## 6. Văn bản dán sẵn cho Claude làm trong repo Sổ Tiền

```text
Khoá phóng to (véo hai ngón và chạm đúp) cho app. Làm đúng như sau, không làm gì thêm:
1. index.html dòng 5: meta viewport thành
   width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no
   (không thêm viewport-fit).
2. style.css: sau khối @media (max-width:700px) ép 16px (quanh dòng 343) thêm
   html{touch-action:pan-x pan-y;-webkit-text-size-adjust:100%}
   kèm comment tiếng Việt ngắn nêu lý do. Không dùng mã màu.
3. js/ui.js, ngoài cùng của file, kiểu ES5 như repo: chặn preventDefault cho
   gesturestart, gesturechange, gestureend trên document (iOS Safari bỏ qua cờ viewport
   nhưng tôn trọng các sự kiện này).
4. Chạy node tools/bump.js, thêm một mục lên đầu NHAT_KY trong js/phienban.js
   (ten "Khoá phóng to", một câu cho người dùng), rồi node tests/run-tests.js phải 0 fail
   và node tools/bump.js --check phải sạch. Không tăng VERSION trong sw.js.
5. Kiểm: meta đúng, getComputedStyle(documentElement).touchAction là "pan-x pan-y",
   dispatch gesturestart có defaultPrevented true. Báo rõ chưa thử trên iPhone thật.
   Soát hai cử chỉ trong js/motion.js (vuốt một ngày ở Sổ tay, kéo xuống để làm mới)
   vẫn hoạt động.
Mở PR mới, mô tả ngắn: lý do, đánh đổi (người cận thị không phóng chữ được),
những gì chưa kiểm chứng.
```
