import { useEffect, useState } from 'preact/hooks'
import { engine, type SyncStatus } from '../sync'
import { Icon } from './Icon'

const LABEL: Record<SyncStatus['state'], string> = {
  idle: 'Chưa đồng bộ',
  syncing: 'Đang đồng bộ…',
  synced: 'Đã đồng bộ',
  offline: 'Offline, sẽ đồng bộ khi có mạng',
  authRequired: 'Chưa đăng nhập, dữ liệu chỉ lưu trên máy',
  error: 'Lỗi đồng bộ, bấm để thử lại',
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

/** The status line under the brand: colour says the state, tapping syncs (or asks to sign in). */
export function SyncIndicator({ onLogin }: { onLogin: () => void }) {
  const [status, setStatus] = useState(engine.getStatus())
  useEffect(() => {
    setStatus(engine.getStatus())
    return engine.subscribe(setStatus)
  }, [])

  const needLogin = status.state === 'authRequired'
  const text =
    status.state === 'synced' && status.lastSyncAt
      ? `Đã đồng bộ lúc ${hhmm(status.lastSyncAt)}`
      : LABEL[status.state]
  return (
    <button
      type="button"
      class={`sync sync-${status.state}`}
      onClick={needLogin ? onLogin : () => void engine.run()}
      title={status.error ?? undefined}
    >
      <Icon name="refresh" size={12} class={status.state === 'syncing' ? 'spin' : ''} />
      {text}
    </button>
  )
}
