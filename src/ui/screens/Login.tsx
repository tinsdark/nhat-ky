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
      <h1>Nhật ký</h1>
      <p class="muted">
        Theo dõi giấc ngủ, ăn uống, công việc, thói quen. Dữ liệu lưu trên máy và đồng bộ qua Google
        Drive của mày.
      </p>
      <div class="stack">
        <button type="button" class="btn btn-primary" disabled={busy} onClick={() => void login()}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập Google'}
        </button>
        <button type="button" class="btn" onClick={onSkip}>
          Dùng ngay, đăng nhập sau
        </button>
      </div>
      {failed && <p class="error">Đăng nhập không thành công, thử lại.</p>}
    </main>
  )
}
