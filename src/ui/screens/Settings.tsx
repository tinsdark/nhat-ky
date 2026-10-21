import { signOut } from '../../auth'
import { engine } from '../../sync'

export function Settings({ onSignedOut }: { onSignedOut: () => void }) {
  const logout = async () => {
    await signOut()
    engine.markAuthRequired()
    onSignedOut()
  }
  return (
    <section class="screen">
      <h1>Cài đặt</h1>
      <div class="stack">
        <button type="button" class="btn" onClick={() => void engine.run()}>
          Đồng bộ ngay
        </button>
        <button type="button" class="btn btn-danger" onClick={() => void logout()}>
          Đăng xuất
        </button>
      </div>
    </section>
  )
}
