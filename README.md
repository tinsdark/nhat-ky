# Nhật ký

Webapp cá nhân theo dõi đồng hồ sinh hoạt (ngủ, ăn, làm việc, thói quen, năng lượng, tâm trạng) và đưa lời khuyên có số liệu. Một người dùng, chủ yếu trên iPhone (PWA). Không theo dõi tiền.

- Local-first: dữ liệu nằm trong IndexedDB, đồng bộ qua Google Drive `appDataFolder` của chính người dùng. Không có server.
- Đặc tả: `docs/SPEC.md` · Kế hoạch: `docs/PLAN.md` · Trạng thái: `docs/HANDOFF.md` · Quy tắc cho Claude: `CLAUDE.md`.

## Chạy

```
npm ci
npm run dev        # http://localhost:5173/nhat-ky/
npm run test       # vitest
npm run lint
npm run build      # tsc + vite build → dist/
```

Kiểm tra trên trình duyệt (dùng Playwright có sẵn trên máy, không phải dependency của dự án):

```
npx vite preview --port 4173 && npm run e2e     # luồng chính, trên bản build
npm run dev && npm run e2e:contrast            # tương phản chữ/nền theo buổi × theme
```

## Deploy

Push `main` → GitHub Actions (`deploy.yml`) chạy lint, test, build rồi đăng lên GitHub Pages (`base: /nhat-ky/`). PR và nhánh `claude/**` chạy cùng các bước kiểm ở `ci.yml`, không đăng.

## Đăng nhập Google

OAuth client ID (public) ở `src/config.ts`, scope duy nhất `drive.appdata`. Trong Google Cloud Console của client đó: Authorized JavaScript origins có origin Pages và `http://localhost:5173`; consent screen ở chế độ Testing, email người dùng nằm trong Test users; Drive API đã bật.
