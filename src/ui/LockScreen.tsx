import { useEffect, useState } from 'preact/hooks'
import { appLock } from '../lock'

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const unlock = async () => {
    setBusy(true)
    setFailed(false)
    if (await appLock.unlock()) onUnlocked()
    else setFailed(true)
    setBusy(false)
  }
  useEffect(() => {
    void unlock()
  }, [])
  return (
    <main class="login">
      <h1>Nhật ký</h1>
      <p class="muted">App đang khoá. Mở khoá bằng Face ID, vân tay hoặc mã máy.</p>
      <div class="stack">
        <button type="button" class="btn btn-primary" disabled={busy} onClick={() => void unlock()}>
          Mở khoá
        </button>
      </div>
      {failed && <p class="error">Chưa mở khoá được, thử lại.</p>}
    </main>
  )
}
