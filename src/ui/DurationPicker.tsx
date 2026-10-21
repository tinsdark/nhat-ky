import { DURATION_CHOICES, formatDuration } from '../core/entryForm'

/** "Vừa làm xong bao lâu?": the block ends now and starts that long ago. */
export function DurationPicker({
  title,
  onPick,
  onMore,
  onClose,
}: {
  title: string
  onPick: (minutes: number) => void
  /** Opens the full form instead, for when the estimate needs more than a duration. */
  onMore: () => void
  onClose: () => void
}) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{title}: vừa làm xong bao lâu?</h2>
        <p class="muted hint">
          Ước lượng thôi. Khối sẽ kết thúc bây giờ và bắt đầu cách đây đúng khoảng đó.
        </p>
        <div class="choice big">
          {DURATION_CHOICES.map((m) => (
            <button type="button" onClick={() => onPick(m)}>
              {formatDuration(m)}
            </button>
          ))}
        </div>
        <button type="button" class="btn" onClick={onMore}>
          Chọn giờ cụ thể…
        </button>
      </div>
    </div>
  )
}
