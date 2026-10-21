import { useEffect, useState } from 'preact/hooks'
import { engine, type SyncStatus } from '../sync'

const LABEL: Record<SyncStatus['state'], string> = {
  idle: 'Chưa đồng bộ',
  syncing: 'Đang đồng bộ…',
  synced: 'Đã đồng bộ',
  offline: 'Offline',
  authRequired: 'Chưa đăng nhập',
  error: 'Lỗi đồng bộ',
}

export function SyncIndicator({ onLogin }: { onLogin: () => void }) {
  const [status, setStatus] = useState(engine.getStatus())
  useEffect(() => {
    setStatus(engine.getStatus())
    return engine.subscribe(setStatus)
  }, [])

  const needLogin = status.state === 'authRequired'
  return (
    <button
      type="button"
      class={`sync sync-${status.state}`}
      onClick={needLogin ? onLogin : () => void engine.run()}
      title={status.error ?? undefined}
    >
      <span class="dot" />
      {needLogin ? 'Đăng nhập lại' : LABEL[status.state]}
    </button>
  )
}
