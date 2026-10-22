import { useState } from 'preact/hooks'
import { addFakeData, addPersonaMonth, clearFakeData } from '../dev/panel'
import { Section } from './settings/fields'

/** Only reachable in `npm run dev`; the production build never includes it. */
export default function DevPanel() {
  const [msg, setMsg] = useState('')
  const run = async (label: string, job: () => Promise<number>) => {
    setMsg(`${label}…`)
    setMsg(`${label}: ${await job()} bản ghi`)
  }
  return (
    <Section
      title="Dev: dữ liệu test"
      tint="warn"
      hint="Chỉ có khi chạy npm run dev. Bản deploy không chứa phần này."
    >
      <div class="btnlist">
        <button
          type="button"
          class="btn"
          onClick={() => void run('Tháng 10/2026', () => addPersonaMonth())}
        >
          Sinh tháng 10/2026 (người dùng mẫu)
        </button>
        <button
          type="button"
          class="btn"
          onClick={() => void run('Sinh 60 ngày', () => addFakeData(60))}
        >
          Sinh 60 ngày dữ liệu giả
        </button>
        <button
          type="button"
          class="btn"
          onClick={() => void run('Sinh 365 ngày', () => addFakeData(365))}
        >
          Sinh 365 ngày dữ liệu giả
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onClick={() => void run('Đã xoá', clearFakeData)}
        >
          Xoá dữ liệu test
        </button>
      </div>
      {msg && <p class="muted">{msg}</p>}
    </Section>
  )
}
