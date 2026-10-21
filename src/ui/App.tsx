import { useEffect, useState } from 'preact/hooks'
import { signIn } from '../auth'
import { engine, type SyncStatus } from '../sync'

const LABEL: Record<SyncStatus['state'], string> = {
  idle: 'Chưa đồng bộ',
  syncing: 'Đang đồng bộ…',
  synced: 'Đã đồng bộ',
  offline: 'Offline — sẽ đồng bộ khi có mạng',
  authRequired: 'Cần đăng nhập để đồng bộ',
  error: 'Lỗi đồng bộ',
}

// Temporary shell for T0.6; replaced by the real app shell in T1.1.
export function App() {
  const [status, setStatus] = useState(engine.getStatus())
  useEffect(() => {
    setStatus(engine.getStatus()) // startSync() may have changed it before this effect ran
    return engine.subscribe(setStatus)
  }, [])

  const login = () =>
    signIn()
      .then(() => engine.run())
      .catch(() => engine.markAuthRequired())

  return (
    <main>
      <h1>Nhật ký</h1>
      <p>
        {LABEL[status.state]}
        {status.state === 'synced' && status.lastSyncAt
          ? ` lúc ${new Date(status.lastSyncAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
          : ''}
        {status.error ? ` (${status.error})` : ''}
      </p>
      {status.state === 'authRequired' && (
        <button type="button" onClick={login} style={{ minHeight: 44 }}>
          Đăng nhập
        </button>
      )}
    </main>
  )
}
