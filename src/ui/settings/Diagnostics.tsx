import { useEffect, useState } from 'preact/hooks'
import { toHHmm } from '../../core/date'
import { formatErrorLog } from '../../core/errorLog'
import { db } from '../../data/db'
import { clearErrorLog, getErrorLog } from '../../data/errorLog'
import { getStorageStatus, requestPersistentStorage, type StorageStatus } from '../../data/storage'
import { engine } from '../../sync'
import { useLive } from '../useLive'
import { Section, SetRow } from './fields'

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB`
const stamp = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${toHHmm(iso)}`

/** Records written on this device that Drive does not have yet. */
async function pendingCount(): Promise<number> {
  const [entries, days, defs, settings, insights] = await Promise.all([
    db.entries.where('dirty').equals(1).count(),
    db.days.where('dirty').equals(1).count(),
    db.defs.get('defs'),
    db.settings.get('settings'),
    db.insights.get('insights'),
  ])
  return entries + days + [defs, settings, insights].filter((d) => d?.dirty === 1).length
}

/** Last sync, what is still waiting, the last error: enough to tell whether Drive is up to date. */
export function SyncHealth() {
  const [status, setStatus] = useState(engine.getStatus())
  useEffect(() => engine.subscribe(setStatus), [])
  const pending = useLive(pendingCount, [])
  return (
    <>
      <SetRow title="Lần đồng bộ cuối">
        <span class="muted">{status.lastSyncAt ? stamp(status.lastSyncAt) : 'chưa có'}</span>
      </SetRow>
      <SetRow title="Chờ đẩy lên Drive" hint="Số mục đã ghi trên máy này mà Drive chưa có.">
        <span class="muted">{pending ?? '…'} mục</span>
      </SetRow>
      {status.state === 'error' && status.error && (
        <p class="muted hint">Lỗi đồng bộ gần nhất: {status.error}</p>
      )}
    </>
  )
}

/** Whether the browser promised to keep this app's data, and how much it uses. */
export function StorageSection() {
  const [s, setS] = useState<StorageStatus | null>(null)
  const load = () => void getStorageStatus().then(setS)
  useEffect(load, [])
  return (
    <Section
      title="Lưu trữ trên máy"
      hint="Lưu trữ bền: trình duyệt hứa không tự xoá dữ liệu của app khi máy đầy. Mục chưa đồng bộ chỉ nằm ở đây."
    >
      <SetRow title="Lưu trữ bền">
        {s?.persisted === false ? (
          <button
            type="button"
            class="btn small"
            onClick={() => void requestPersistentStorage().then(load)}
          >
            Xin lại
          </button>
        ) : (
          <span class="muted">{s ? (s.persisted ? 'Có' : 'Không rõ') : '…'}</span>
        )}
      </SetRow>
      {s?.usedBytes != null && (
        <SetRow title="Đã dùng">
          <span class="muted">
            {mb(s.usedBytes)}
            {s.quotaBytes ? ` / ${mb(s.quotaBytes)}` : ''}
          </span>
        </SetRow>
      )}
    </Section>
  )
}

/** Errors kept on this device, readable on a phone where there is no console. */
export function ErrorLogSection() {
  const log = useLive(getErrorLog, [])
  const [msg, setMsg] = useState('')
  if (!log) return null
  return (
    <Section title="Nhật ký lỗi" hint="Lỗi ghi lại trên máy này, không gửi đi đâu. Tối đa 50 dòng.">
      {log.length === 0 ? (
        <p class="muted hint">Chưa có lỗi nào.</p>
      ) : (
        <>
          <ul class="errlog">
            {log.slice(0, 10).map((l) => (
              <li key={l.at + l.where}>
                <span class="muted">
                  {stamp(l.at)} · {l.where}
                </span>
                <span>{l.message}</span>
              </li>
            ))}
          </ul>
          <div class="btnlist">
            <button
              type="button"
              class="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(formatErrorLog(log))
                  setMsg('Đã chép.')
                } catch {
                  setMsg('Không chép được trên máy này.')
                }
              }}
            >
              Chép nhật ký
            </button>
            <button type="button" class="btn" onClick={() => void clearErrorLog()}>
              Xoá nhật ký
            </button>
          </div>
          {msg && <p class="muted hint">{msg}</p>}
        </>
      )}
    </Section>
  )
}
