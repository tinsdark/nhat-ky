import { useState } from 'preact/hooks'
import { toDateKey } from '../core/date'
import { parsePurgeRange } from '../core/purge'
import { executePurge, planPurge, type PurgePlan } from '../data/purge'
import { photos } from '../photos'
import { engine } from '../sync'
import { Section } from './settings/fields'

const CONFIRM_WORD = 'XOA'

const vn = (dateKey: string) => `${dateKey.slice(8)}/${dateKey.slice(5, 7)}/${dateKey.slice(0, 4)}`

function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Deletes the entries and day ratings of a range of days. Preview first, then a typed confirmation. */
export function PurgeSection({ dayStartHour }: { dayStartHour: number }) {
  const today = toDateKey(Date.now(), dayStartHour)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [plan, setPlan] = useState<PurgePlan | null>(null)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Any change to the dates throws the preview away: it must match what is on screen.
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v)
    setPlan(null)
    setWord('')
    setMsg('')
  }

  const preview = async () => {
    const parsed = parsePurgeRange(from, to, today)
    if ('error' in parsed) return setMsg(parsed.error)
    setPlan(await planPurge(parsed.range))
    setWord('')
    setMsg('')
  }

  const run = async () => {
    if (!plan || word.trim().toUpperCase() !== CONFIRM_WORD) return
    setBusy(true)
    try {
      // The backup goes first: if the download fails, nothing has been deleted.
      downloadJson(`nhat-ky-da-xoa-${plan.stamp.slice(0, 10)}.json`, plan.backup)
      const r = await executePurge(plan, (ids) => photos.remove(ids))
      void engine.run()
      setPlan(null)
      setWord('')
      setMsg(
        `Đã xoá ${r.entries} mục, ${r.days} ngày chấm, ${r.photos} ảnh. File sao lưu vừa tải về: dùng "Khôi phục từ JSON" nếu cần lấy lại (không kèm ảnh).`,
      )
    } finally {
      setBusy(false)
    }
  }

  const count = plan ? plan.entryIds.length + plan.dayKeys.length : 0
  return (
    <Section
      title="Xoá dữ liệu theo ngày"
      hint="Xoá các mục đã ghi (Đã ghi trong ngày) và điểm chấm ngày trong khoảng chọn, gồm cả hai ngày đầu và cuối. Bỏ trống ô Từ ngày = xoá từ đầu đến Đến ngày. Không đụng thói quen, danh mục, nút nhanh, cài đặt. Việc xoá được đồng bộ: các máy khác đã đăng nhập cũng mất dữ liệu trong khoảng đó."
    >
      <div class="form">
        <div class="row">
          <label>
            Từ ngày
            <input
              type="date"
              value={from}
              onChange={(e) => edit(setFrom)(e.currentTarget.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={to}
              max={today}
              onChange={(e) => edit(setTo)(e.currentTarget.value)}
            />
          </label>
        </div>
        <button type="button" class="btn" onClick={() => void preview()}>
          Xem trước
        </button>
        {plan && (
          <div class="warn-box">
            {count === 0 ? (
              <p>Không có gì để xoá trong khoảng này.</p>
            ) : (
              <>
                <p>
                  <strong>
                    Sẽ xoá {plan.entryIds.length} mục, {plan.dayKeys.length} ngày chấm
                    {plan.photoIds.length > 0 ? `, ${plan.photoIds.length} ảnh` : ''}
                  </strong>{' '}
                  {plan.range.from ? `từ ${vn(plan.range.from)}` : 'từ đầu'} đến {vn(plan.range.to)}
                  .
                </p>
                <p class="muted">
                  App tự tải một file sao lưu những gì sắp xoá trước khi xoá. Gõ {CONFIRM_WORD} để
                  mở nút xoá.
                </p>
                <label>
                  Gõ {CONFIRM_WORD} để xác nhận
                  <input
                    value={word}
                    autocapitalize="characters"
                    onInput={(e) => setWord(e.currentTarget.value)}
                  />
                </label>
                <button
                  type="button"
                  class="btn btn-danger"
                  disabled={busy || word.trim().toUpperCase() !== CONFIRM_WORD}
                  onClick={() => void run()}
                >
                  Xoá {count} bản ghi
                </button>
              </>
            )}
          </div>
        )}
        {msg && <p class="notice-line">{msg}</p>}
      </div>
    </Section>
  )
}
