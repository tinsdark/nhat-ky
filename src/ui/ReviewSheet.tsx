import { useEffect, useState } from 'preact/hooks'
import type { DayType, Rating } from '../core/types'
import { isMet, isScheduled, valuesByDate } from '../core/habits'
import { tickHabit } from '../data/habits'
import { getDay, getDefs, getEntriesByDateKey, getSettings, saveDay } from '../data/repository'
import { useLive } from './useLive'
import { Choice, scale } from './Choice'

const DAY_TYPES: { id: DayType; label: string }[] = [
  { id: 'workday', label: 'Đi làm' },
  { id: 'weekend', label: 'Cuối tuần' },
  { id: 'holiday', label: 'Nghỉ lễ' },
  { id: 'sick', label: 'Ốm' },
  { id: 'travel', label: 'Đi xa' },
]

export function ReviewSheet({ dateKey, onClose }: { dateKey: string; onClose: () => void }) {
  const [mood, setMood] = useState<Rating | null>(null)
  const [energy, setEnergy] = useState<Rating | null>(null)
  const [stress, setStress] = useState<Rating | null>(null)
  const [focus, setFocus] = useState<Rating | null>(null)
  const [dayScore, setDayScore] = useState<number | null>(null)
  const [highlight, setHighlight] = useState('')
  const [dayType, setDayType] = useState<DayType | null>(null)

  useEffect(() => {
    void getDay(dateKey).then((d) => {
      if (!d) return
      setMood(d.mood)
      setEnergy(d.energy)
      setStress(d.stress)
      setFocus(d.focus)
      setDayScore(d.dayScore)
      setHighlight(d.highlight)
      setDayType(d.dayType)
    })
  }, [dateKey])

  const settings = useLive(getSettings, [])
  const defs = useLive(getDefs, [])
  const entries = useLive(() => getEntriesByDateKey(dateKey), [dateKey])
  // Habits due that day and not yet met; linked ones fill themselves from other entries.
  const pending = (defs?.habits ?? []).filter((h) => {
    if (
      h.archived ||
      h.linkedRule ||
      h.metricRule ||
      h.direction === 'quit' ||
      !isScheduled(h, dateKey)
    )
      return false
    return !isMet(h, valuesByDate(h, entries ?? []).get(dateKey) ?? 0)
  })

  const save = async () => {
    await saveDay(dateKey, {
      mood,
      energy,
      stress,
      focus,
      dayScore,
      highlight: highlight.trim(),
      dayType,
    })
    onClose()
  }

  const rating = (set: (r: Rating | null) => void) => (n: number | undefined) =>
    set((n ?? null) as Rating | null)

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <form
        class="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <h2>
          Chấm ngày {dateKey.slice(8)}/{dateKey.slice(5, 7)}
        </h2>
        <Choice label="Tâm trạng" options={scale(5)} value={mood} onChange={rating(setMood)} />
        <Choice label="Năng lượng" options={scale(5)} value={energy} onChange={rating(setEnergy)} />
        <Choice label="Stress" options={scale(5)} value={stress} onChange={rating(setStress)} />
        <Choice label="Tập trung" options={scale(5)} value={focus} onChange={rating(setFocus)} />
        <Choice
          label="Điểm cả ngày (1–10)"
          options={scale(10)}
          value={dayScore}
          onChange={(n) => setDayScore(n ?? null)}
        />
        <label>
          Điều đáng nhớ nhất
          <input value={highlight} onInput={(e) => setHighlight(e.currentTarget.value)} />
        </label>
        <Choice
          label="Loại ngày"
          options={DAY_TYPES}
          value={dayType}
          onChange={(v) => setDayType(v ?? null)}
        />
        {pending.length > 0 && (
          <fieldset class="group">
            <legend>Thói quen chưa tick</legend>
            {pending.map((h) => (
              <button
                type="button"
                class="btn"
                onClick={() => void tickHabit(h, dateKey, settings?.dayStartHour ?? 4)}
              >
                ✓ {h.name}
              </button>
            ))}
          </fieldset>
        )}
        <div class="row">
          <button type="button" class="btn" onClick={onClose}>
            Để sau
          </button>
          <button type="submit" class="btn btn-primary">
            Lưu
          </button>
        </div>
      </form>
    </div>
  )
}
