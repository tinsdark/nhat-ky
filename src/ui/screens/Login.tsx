import { useState } from 'preact/hooks'
import { signIn } from '../../auth'
import { engine } from '../../sync'

export function Login({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const login = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await signIn()
      onDone()
      void engine.run()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="login">
      <div class="gate-hero">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="84" height="84" />
        <h1>Nhật ký</h1>
        <p class="muted">
          Theo dõi giấc ngủ, ăn uống, công việc, thói quen và tìm ra nhịp sống hợp với mày.
        </p>
      </div>
      <div class="panel">
        <h2 class="gate-title">Chào mừng</h2>
        <p class="muted">
          Đăng nhập Google để dữ liệu được đồng bộ qua Google Drive của chính mày, hoặc vào luôn mà
          không cần đăng nhập.
        </p>
        <div class="stack">
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy}
            onClick={() => void login()}
          >
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập với Google'}
          </button>
          <button type="button" class="btn" onClick={onSkip}>
            Dùng ngay, đăng nhập sau
          </button>
        </div>
        {failed && <p class="error">Đăng nhập không thành công, thử lại.</p>}
        <ul class="gate-points">
          <li>Dữ liệu nằm trên máy mày và Drive của mày, không qua máy chủ nào khác.</li>
          <li>Mở là vào thẳng, ghi được cả khi mất mạng.</li>
          <li>Không theo dõi tiền.</li>
        </ul>
      </div>
    </main>
  )
}
