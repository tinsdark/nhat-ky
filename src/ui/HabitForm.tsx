import { useState } from 'preact/hooks'
import type { Habit, HabitSchedule } from '../core/types'
import { newHabitId, upsertHabit } from '../data/habits'
import { Choice } from './Choice'

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export function HabitForm({
  habit,
  startDate,
  onClose,
}: {
  habit: Habit | null
  startDate: string
  onClose: () => void
}) {
  const [name, setName] = useState(habit?.name ?? '')
  const [direction, setDirection] = useState<Habit['direction']>(habit?.direction ?? 'build')
  const [kind, setKind] = useState<Habit['kind']>(habit?.kind ?? 'check')
  const [op, setOp] = useState<Habit['target']['op']>(
    habit?.target.op ?? (direction === 'quit' ? '=' : '>='),
  )
  const [target, setTarget] = useState(String(habit?.target.value ?? 1))
  const [schedule, setSchedule] = useState<HabitSchedule>(habit?.schedule ?? { kind: 'daily' })
  const [reminder, setReminder] = useState(habit?.reminderTime ?? '')
  const [error, setError] = useState('')

  const save = async () => {
    const value = Number(target.replace(',', '.'))
    if (name.trim() === '') return setError('Nhập tên thói quen.')
    if (Number.isNaN(value)) return setError('Mục tiêu không hợp lệ.')
    if (schedule.kind === 'weekdays' && schedule.days.length === 0)
      return setError('Chọn ít nhất 1 ngày.')
    await upsertHabit({
      id: habit?.id ?? newHabitId(),
      name: name.trim(),
      direction,
      kind,
      target: { op, value },
      schedule,
      reminderTime: reminder || null,
      linkedRule: habit?.linkedRule ?? null,
      startDate: habit?.startDate ?? startDate,
      archived: habit?.archived ?? false,
    })
    onClose()
  }

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
        <h2>{habit ? 'Sửa thói quen' : 'Thói quen mới'}</h2>
        <label>
          Tên
          <input value={name} onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <Choice
          label="Hướng"
          options={[
            { id: 'build', label: 'Xây' },
            { id: 'quit', label: 'Bỏ' },
          ]}
          value={direction}
          onChange={(v) => v && setDirection(v)}
        />
        <Choice
          label="Kiểu"
          options={[
            { id: 'check', label: 'Có/không' },
            { id: 'count', label: 'Số lần' },
            { id: 'duration', label: 'Số phút' },
          ]}
          value={kind}
          onChange={(v) => v && setKind(v)}
        />
        <div class="row">
          <Choice
            label="Đạt khi"
            options={[
              { id: '>=', label: '≥' },
              { id: '<=', label: '≤' },
              { id: '=', label: '=' },
            ]}
            value={op}
            onChange={(v) => v && setOp(v)}
          />
          <label>
            Mục tiêu
            <input
              inputMode="decimal"
              value={target}
              onInput={(e) => setTarget(e.currentTarget.value)}
            />
          </label>
        </div>
        <Choice
          label="Lịch"
          options={[
            { id: 'daily', label: 'Hằng ngày' },
            { id: 'weekdays', label: 'Thứ cụ thể' },
            { id: 'timesPerWeek', label: 'x lần/tuần' },
          ]}
          value={schedule.kind}
          onChange={(v) => {
            if (v === 'daily') setSchedule({ kind: 'daily' })
            if (v === 'weekdays') setSchedule({ kind: 'weekdays', days: [0, 1, 2, 3, 4] })
            if (v === 'timesPerWeek') setSchedule({ kind: 'timesPerWeek', times: 3 })
          }}
        />
        {schedule.kind === 'weekdays' && (
          <div class="choice">
            {DAY_LABELS.map((label, i) => {
              const on = schedule.days.includes(i)
              return (
                <button
                  type="button"
                  class={on ? 'on' : ''}
                  onClick={() =>
                    setSchedule({
                      kind: 'weekdays',
                      days: on
                        ? schedule.days.filter((d) => d !== i)
                        : [...schedule.days, i].sort(),
                    })
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
        {schedule.kind === 'timesPerWeek' && (
          <Choice
            label="Số lần mỗi tuần"
            options={[1, 2, 3, 4, 5, 6].map((n) => ({ id: n, label: String(n) }))}
            value={schedule.times}
            onChange={(v) => v && setSchedule({ kind: 'timesPerWeek', times: v })}
          />
        )}
        <label>
          Nhắc lúc (tuỳ chọn)
          <input type="time" value={reminder} onInput={(e) => setReminder(e.currentTarget.value)} />
        </label>
        {error && <p class="error">{error}</p>}
        <div class="row">
          <button type="button" class="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" class="btn btn-primary">
            Lưu
          </button>
        </div>
      </form>
    </div>
  )
}
