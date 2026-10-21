import { useState } from 'preact/hooks'
import { entriesToCsv } from '../core/backup'
import { addDays, toDateKey } from '../core/date'
import type { EntryType } from '../core/types'
import { buildSnapshot, parseSnapshot, restoreSnapshot, SnapshotError } from '../backup'
import { getDefs, getEntriesInRange } from '../data/repository'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const TYPES: { id: EntryType | ''; label: string }[] = [
  { id: '', label: 'Tất cả loại' },
  { id: 'sleep', label: 'Ngủ' },
  { id: 'meal', label: 'Ăn uống' },
  { id: 'work', label: 'Làm việc' },
  { id: 'activity', label: 'Hoạt động' },
  { id: 'exercise', label: 'Vận động' },
  { id: 'water', label: 'Nước' },
  { id: 'habit', label: 'Thói quen' },
  { id: 'note', label: 'Check-in/ghi chú' },
]

export function BackupSection({ dayStartHour }: { dayStartHour: number }) {
  const today = toDateKey(Date.now(), dayStartHour)
  const [type, setType] = useState<EntryType | ''>('')
  const [from, setFrom] = useState(addDays(today, -89))
  const [to, setTo] = useState(today)
  const [msg, setMsg] = useState('')

  const exportJson = async () => {
    download(`nhat-ky-${today}.json`, JSON.stringify(await buildSnapshot()), 'application/json')
    setMsg('Đã xuất JSON.')
  }
  const exportCsv = async () => {
    const [entries, defs] = await Promise.all([getEntriesInRange(from, to), getDefs()])
    const rows = entries.filter((e) => !type || e.type === type)
    download(
      `nhat-ky-${type || 'tat-ca'}-${from}_${to}.csv`,
      entriesToCsv(rows, defs.categories),
      'text/csv;charset=utf-8',
    )
    setMsg(`Đã xuất ${rows.length} bản ghi CSV.`)
  }
  const importJson = async (file: File) => {
    try {
      const r = await restoreSnapshot(parseSnapshot(await file.text()))
      setMsg(
        `Đã khôi phục ${r.entries} mục, ${r.days} ngày chấm, ${r.docs} cấu hình (chỉ lấy bản mới hơn bản trên máy).`,
      )
    } catch (err) {
      setMsg(err instanceof SnapshotError ? err.message : 'Không đọc được file.')
    }
  }

  return (
    <>
      <h2 class="sub">Sao lưu và xuất dữ liệu</h2>
      <div class="form">
        <p class="muted hint">
          Mỗi Chủ nhật app tự tạo bản sao lưu trên Drive (giữ 8 bản gần nhất, không kèm ảnh) khi mày
          mở app và đã đăng nhập.
        </p>
        <button type="button" class="btn" onClick={() => void exportJson()}>
          Xuất JSON đầy đủ
        </button>
        <label class="btn filebtn">
          Nhập từ JSON (khôi phục)
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (f) void importJson(f)
            }}
          />
        </label>
        <div class="row">
          <label>
            Từ ngày
            <input type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
          </label>
          <label>
            Đến ngày
            <input type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
          </label>
        </div>
        <label>
          Loại
          <select value={type} onChange={(e) => setType(e.currentTarget.value as EntryType | '')}>
            {TYPES.map((t) => (
              <option value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <button type="button" class="btn" onClick={() => void exportCsv()}>
          Xuất CSV
        </button>
        {msg && <p class="muted">{msg}</p>}
      </div>
    </>
  )
}
