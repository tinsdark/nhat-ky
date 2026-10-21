import { useState } from 'preact/hooks'
import { addFakeData, clearFakeData } from '../dev/panel'

/** Only reachable in `npm run dev`; the production build never includes it. */
export default function DevPanel() {
  const [msg, setMsg] = useState('')
  const run = async (label: string, job: () => Promise<number>) => {
    setMsg(`${label}…`)
    setMsg(`${label}: ${await job()} bản ghi`)
  }
  return (
    <>
      <h2 class="sub">Dev: dữ liệu test</h2>
      <div class="stack">
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
        {msg && <p class="muted">{msg}</p>}
      </div>
    </>
  )
}
