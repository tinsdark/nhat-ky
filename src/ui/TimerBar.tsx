import { useEffect, useState } from 'preact/hooks'
import { formatElapsed } from '../core/timer'
import type { Category, Entry, Rating } from '../core/types'
import { addInterruption, setFocus, stopTimer } from '../data/timer'

export function TimerBar({
  timer,
  categories,
}: {
  timer: Entry | undefined
  categories: Category[]
}) {
  const [now, setNow] = useState(Date.now())
  const [askFocus, setAskFocus] = useState<string | null>(null)

  useEffect(() => {
    if (!timer) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [timer?.id])

  if (askFocus) {
    return (
      <div class="timerbar">
        <span>Tập trung thế nào?</span>
        <div class="focus">
          {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
            <button
              type="button"
              onClick={() => {
                void setFocus(askFocus, n)
                setAskFocus(null)
              }}
            >
              {n}
            </button>
          ))}
          <button type="button" class="skip" onClick={() => setAskFocus(null)}>
            Bỏ qua
          </button>
        </div>
      </div>
    )
  }
  if (!timer) return null

  const label = timer.title || categories.find((c) => c.id === timer.categoryId)?.name || 'Làm việc'
  const interruptions = Number(timer.payload.interruptions ?? 0)
  return (
    <div class="timerbar running">
      <div>
        <div class="muted">Đang làm — {label}</div>
        <strong class="elapsed">{formatElapsed(now - new Date(timer.start).getTime())}</strong>
      </div>
      <div class="actions">
        <button type="button" class="btn" onClick={() => void addInterruption(timer.id)}>
          +1 bị ngắt{interruptions > 0 ? ` (${interruptions})` : ''}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onClick={async () => {
            await stopTimer(timer.id)
            setAskFocus(timer.id)
          }}
        >
          Dừng
        </button>
      </div>
    </div>
  )
}
