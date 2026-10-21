import { toHHmm } from '../core/date'
import type { Rating } from '../core/types'
import { setSleepQuality } from '../data/sleep'

/** Shown after "Thức dậy": optional quality 1–5, one tap or skip. */
export function SleepPrompt({
  id,
  note,
  onClose,
}: {
  id: string
  /** e.g. "Giờ ngủ ước lượng 23:30" when "Đi ngủ" was not pressed. */
  note?: string
  onClose: () => void
}) {
  return (
    <div class="timerbar">
      <div>
        <span>Ngủ có ngon không?</span>
        {note && <div class="muted hint">{note}</div>}
      </div>
      <div class="focus">
        {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
          <button
            type="button"
            onClick={() => {
              void setSleepQuality(id, n)
              onClose()
            }}
          >
            {n}
          </button>
        ))}
        <button type="button" class="skip" onClick={onClose}>
          Bỏ qua
        </button>
      </div>
    </div>
  )
}

export const estimatedNote = (startIso: string) =>
  `Quên bấm "Đi ngủ": tạm tính ngủ lúc ${toHHmm(startIso)}. Sửa ở Hôm nay nếu sai.`
