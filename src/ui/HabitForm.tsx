import { useState } from 'preact/hooks'
import { METRICS } from '../core/metrics'
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
  const [auto, setAuto] = useState(!!habit?.metricRule)
  const [metricId, setMetricId] = useState(habit?.metricRule?.metricId ?? 'bedtime')
  const [metricOp, setMetricOp] = useState<'<=' | '>='>(habit?.metricRule?.op ?? '<=')
  const [metricValue, setMetricValue] = useState(String(habit?.metricRule?.value ?? 23.5))
  const [previousNight, setPreviousNight] = useState(!!habit?.metricRule?.previousNight)
  const [error, setError] = useState('')

  const save = async () => {
    const value = Number(target.replace(',', '.'))
    if (name.trim() === '') return setError('Nhập tên thói quen.')
    if (Number.isNaN(value)) return setError('Mục tiêu không hợp lệ.')
    if (schedule.kind === 'weekdays' && schedule.days.length === 0)
      return setError('Chọn ít nhất 1 ngày.')
    const mv = Number(metricValue.replace(',', '.'))
    if (auto && Number.isNaN(mv)) return setError('Ngưỡng của chỉ số không hợp lệ.')
    await upsertHabit({
      id: habit?.id ?? newHabitId(),
      name: name.trim(),
      direction,
      kind: auto ? 'check' : kind,
      target: auto ? { op: '>=', value: 1 } : { op, value },
      schedule,
      reminderTime: reminder || null,
      linkedRule: habit?.linkedRule ?? null,
      metricRule: auto ? { metricId, op: metricOp, value: mv, previousNight } : null,
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
          label="Cách tính"
          options={[
            { id: 'manual', label: 'Tự tick' },
            { id: 'auto', label: 'Tự tính từ chỉ số' },
          ]}
          value={auto ? 'auto' : 'manual'}
          onChange={(v) => v && setAuto(v === 'auto')}
        />
        {auto && (
          <>
            <label>
              Chỉ số
              <select value={metricId} onChange={(e) => setMetricId(e.currentTarget.value)}>
                {METRICS.map((m) => (
                  <option value={m.id}>
                    {m.label} ({m.unit})
                  </option>
                ))}
              </select>
            </label>
            <div class="row">
              <Choice
                label="Đạt khi"
                options={[
                  { id: '<=', label: '≤' },
                  { id: '>=', label: '≥' },
                ]}
                value={metricOp}
                onChange={(v) => v && setMetricOp(v)}
              />
              <label>
                Ngưỡng
                <input
                  inputMode="decimal"
                  value={metricValue}
                  onInput={(e) => setMetricValue(e.currentTarget.value)}
                />
              </label>
            </div>
            <Choice
              label="Lấy chỉ số của"
              options={[
                { id: 'same', label: 'Cùng ngày' },
                { id: 'prev', label: 'Đêm hôm trước' },
              ]}
              value={previousNight ? 'prev' : 'same'}
              onChange={(v) => v && setPreviousNight(v === 'prev')}
            />
            <p class="muted hint">
              Giờ đi ngủ tính theo số giờ, sau nửa đêm cộng 24 (23:30 = 23,5; 00:30 = 24,5). Chọn
              "Đêm hôm trước" cho giờ dậy.
            </p>
          </>
        )}
        {!auto && (
          <>
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
          </>
        )}
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
