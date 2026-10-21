import { useState } from 'preact/hooks'
import { toHHmm, toIso } from '../core/date'
import { bedtimeBefore } from '../core/sleep'
import type { Rating } from '../core/types'
import { recordNight, setSleepQuality } from '../data/sleep'

export type SleepPromptState =
  { mode: 'quality'; id: string } | { mode: 'night'; suggestion: string | null }

/** Inline bar after "Thức dậy" (quality 1–5) or when last night was not recorded (bed + wake time). */
export function SleepPrompt({
  state,
  onClose,
  onRecorded,
}: {
  state: SleepPromptState
  onClose: () => void
  onRecorded: (id: string) => void
}) {
  if (state.mode === 'quality') {
    return (
      <div class="timerbar">
        <span>Ngủ có ngon không?</span>
        <div class="focus">
          {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
            <button
              type="button"
              onClick={() => {
                void setSleepQuality(state.id, n)
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
  return <NightForm suggestion={state.suggestion} onClose={onClose} onRecorded={onRecorded} />
}

function NightForm({
  suggestion,
  onClose,
  onRecorded,
}: {
  suggestion: string | null
  onClose: () => void
  onRecorded: (id: string) => void
}) {
  const [bed, setBed] = useState(suggestion ?? '23:30')
  const [wake, setWake] = useState(toHHmm(Date.now()))
  const [error, setError] = useState('')

  const save = async () => {
    const now = Date.now()
    const start = bedtimeBefore(now, bed)
    // Waking up always happens on today's calendar date.
    const end = `${toIso(now).slice(0, 10)}T${wake}:00.000+07:00`
    if (new Date(end).getTime() <= new Date(start).getTime())
      return setError('Giờ dậy phải sau giờ ngủ.')
    onRecorded((await recordNight(start, end)).id)
  }

  return (
    <div class="timerbar night">
      <strong>Tối qua ngủ lúc mấy giờ?</strong>
      <div class="row">
        <label>
          Ngủ lúc
          <input type="time" value={bed} onInput={(e) => setBed(e.currentTarget.value)} />
        </label>
        <label>
          Dậy lúc
          <input type="time" value={wake} onInput={(e) => setWake(e.currentTarget.value)} />
        </label>
      </div>
      {error && <p class="error">{error}</p>}
      <div class="row">
        <button type="button" class="btn" onClick={onClose}>
          Để sau
        </button>
        <button type="button" class="btn btn-primary" onClick={() => void save()}>
          Lưu
        </button>
      </div>
    </div>
  )
}
