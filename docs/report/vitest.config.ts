import { defineConfig } from 'vitest/config'

// Chạy: npx vitest run --config docs/report/vitest.config.ts
// Tính số liệu cho báo cáo từ dữ liệu mẫu và ghi docs/report/data/*.json.
export default defineConfig({ test: { include: ['docs/report/*.run.ts'] } })
