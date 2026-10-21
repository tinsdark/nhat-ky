import { useState } from 'preact/hooks'
import { entriesToCsv } from '../core/backup'
import { addDays, toDateKey } from '../core/date'
import type { EntryType } from '../core/types'
import { buildSnapshot, parseSnapshot, restoreSnapshot, SnapshotError } from '../backup'
import { importCsv } from '../backup/importCsv'
import { buildZip } from '../backup/zip'
import { photos } from '../photos'
import { db } from '../data/db'
import { getDefs, getEntriesInRange } from '../data/repository'
import { Section } from './settings/fields'

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
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
      entriesToCsv(rows, defs.categories, defs.tags),
      'text/csv;charset=utf-8',
    )
    setMsg(`Đã xuất ${rows.length} bản ghi CSV.`)
  }
  /** JSON plus every photo that live entries point to, in one zip (SPEC 10.4). Photos only on Drive are downloaded first. */
  const exportZip = async () => {
    setMsg('Đang gom ảnh…')
    const snap = await buildSnapshot()
    const ids = new Set<string>()
    await db.entries.each((e) => {
      if (!e.deleted) for (const id of e.photoIds) ids.add(id)
    })
    const files = [{ name: 'nhat-ky.json', data: new TextEncoder().encode(JSON.stringify(snap)) }]
    let missing = 0
    for (const id of ids) {
      const blob = await photos.load(id, 'blob').catch(() => null)
      if (blob)
        files.push({ name: `photos/${id}.webp`, data: new Uint8Array(await blob.arrayBuffer()) })
      else missing++
    }
    download(`nhat-ky-${today}.zip`, buildZip(files) as BlobPart, 'application/zip')
    setMsg(
      `Đã xuất zip: ${files.length - 1} ảnh${missing ? `, ${missing} ảnh không tải được (chỉ còn bản thu nhỏ hoặc đã mất)` : ''}.`,
    )
  }
  const importCsvFile = async (file: File) => {
    try {
      const r = await importCsv(await file.text())
      const bad = r.errors.length
        ? ` Bỏ qua ${r.errors.length} dòng lỗi (đầu tiên: dòng ${r.errors[0]!.line}, ${r.errors[0]!.reason})`
        : ''
      setMsg(`Đã nhập ${r.imported} mục, ${r.duplicates} mục trùng bị bỏ qua.${bad}`)
    } catch {
      setMsg('Không đọc được file CSV.')
    }
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
      <Section
        title="Sao lưu"
        hint="Mỗi Chủ nhật app tự tạo bản sao lưu trên Drive (giữ 8 bản gần nhất, không kèm ảnh) khi mày mở app và đã đăng nhập."
      >
        <div class="btnlist">
          <button type="button" class="btn" onClick={() => void exportJson()}>
            Xuất JSON đầy đủ
          </button>
          <button type="button" class="btn" onClick={() => void exportZip()}>
            Xuất JSON kèm ảnh (zip)
          </button>
          <label class="btn filebtn">
            Khôi phục từ JSON
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
        </div>
      </Section>

      <Section
        title="Xuất và nhập CSV"
        hint="CSV mở được bằng Excel. Nhập CSV bỏ qua các dòng trùng với dữ liệu đang có."
      >
        <div class="form">
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
          <div class="btnlist">
            <button type="button" class="btn" onClick={() => void exportCsv()}>
              Xuất CSV
            </button>
            <label class="btn filebtn">
              Nhập từ CSV
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0]
                  e.currentTarget.value = ''
                  if (f) void importCsvFile(f)
                }}
              />
            </label>
          </div>
        </div>
      </Section>
      {msg && <p class="notice-line">{msg}</p>}
    </>
  )
}
