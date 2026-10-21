import { useMemo, useState } from 'preact/hooks'
import { createMetricContext } from '../../core/metrics'
import { addDays, toDateKey } from '../../core/date'
import {
  completionRate,
  heatmap,
  isMet,
  isScheduled,
  streaks,
  type HabitOptions,
} from '../../core/habits'
import type { Habit } from '../../core/types'
import { tickHabit, untickHabit, upsertHabit } from '../../data/habits'
import { getDaysInRange, getDefs, getEntriesInRange, getSettings } from '../../data/repository'
import { HabitForm } from '../HabitForm'
import { useLive } from '../useLive'

const HISTORY_DAYS = 120
const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)

export function Habits() {
  const settings = useLive(getSettings, [])
  const defs = useLive(getDefs, [])
  const dayStartHour = settings?.dayStartHour ?? 4
  const today = toDateKey(Date.now(), dayStartHour)
  const from = addDays(today, -HISTORY_DAYS)
  const entries = useLive(() => getEntriesInRange(from, today), [from, today])
  const days = useLive(() => getDaysInRange(from, today), [from, today])
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const ctx = useMemo(
    () =>
      settings && defs && entries && days
        ? createMetricContext({ entries, days, habits: defs.habits, settings })
        : null,
    [settings, defs, entries, days],
  )
  if (!settings || !defs || !entries || !days || !ctx) return null

  const opts: HabitOptions = {
    skipRestDays: settings.skipRestDays,
    dayTypes: new Map(days.map((d) => [d.dateKey, d.dayType])),
  }
  const active = defs.habits.filter((h) => !h.archived)
  const archived = defs.habits.filter((h) => h.archived)
  const dueToday = active.filter((h) => isScheduled(h, today))
  const offToday = active.filter((h) => !isScheduled(h, today))

  const row = (h: Habit) => {
    const values = ctx.habitValues(h)
    const value = values.get(today) ?? 0
    const met = isMet(h, value) && (h.direction === 'quit' || value > 0)
    const st = streaks(h, values, today, opts)
    const unit = h.schedule.kind === 'timesPerWeek' ? 'tuần' : 'ngày'
    const linked = h.linkedRule !== null || !!h.metricRule
    return (
      <li class="habit">
        <div class="habit-main">
          <button
            type="button"
            class="habit-name"
            onClick={() => setOpen(open === h.id ? null : h.id)}
          >
            <strong>{h.name}</strong>
            <span class="muted">
              {h.kind === 'check' ? (met ? 'Đã xong' : 'Chưa') : `${value}/${h.target.value}`}
              {' · '}🔥 {st.current} {unit} (dài nhất {st.longest})
            </span>
          </button>
          {linked ? (
            <span class="muted auto">tự tính</span>
          ) : h.kind === 'check' ? (
            <button
              type="button"
              class={met ? 'tick on' : 'tick'}
              aria-label={met ? 'Bỏ tick' : 'Tick'}
              onClick={() => void (met ? untickHabit(h, today) : tickHabit(h, today, dayStartHour))}
            >
              ✓
            </button>
          ) : (
            <button
              type="button"
              class="tick"
              aria-label="Thêm"
              onClick={() => void tickHabit(h, today, dayStartHour, h.kind === 'duration' ? 10 : 1)}
            >
              {h.kind === 'duration' ? '+10′' : '+1'}
            </button>
          )}
        </div>
        {open === h.id && (
          <div class="habit-detail">
            <p class="muted">
              Tỷ lệ: 7 ngày {pct(completionRate(h, values, today, 7, opts))} · 30 ngày{' '}
              {pct(completionRate(h, values, today, 30, opts))} · 90 ngày{' '}
              {pct(completionRate(h, values, today, 90, opts))}
            </p>
            <div class="heat" aria-label="Heatmap 12 tuần">
              {heatmap(h, values, today, 12, opts).map((week) => (
                <div class="heat-col">
                  {week.map((c) => (
                    <span class={`cell ${c.status}`} title={c.dateKey} />
                  ))}
                </div>
              ))}
            </div>
            <div class="row">
              {!linked && h.kind !== 'check' && value > 0 && (
                <button type="button" class="btn" onClick={() => void untickHabit(h, today)}>
                  Hoàn tác lần cuối
                </button>
              )}
              <button type="button" class="btn" onClick={() => setEditing(h)}>
                Sửa
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => void upsertHabit({ ...h, archived: true })}
              >
                Tắt
              </button>
            </div>
          </div>
        )}
      </li>
    )
  }

  return (
    <section class="screen">
      <h1>Thói quen</h1>
      {dueToday.length === 0 && <p class="muted">Hôm nay không có thói quen nào theo lịch.</p>}
      <ul class="habits">{dueToday.map(row)}</ul>
      {offToday.length > 0 && (
        <>
          <h2 class="sub">Không có lịch hôm nay</h2>
          <ul class="habits">{offToday.map(row)}</ul>
        </>
      )}
      <button type="button" class="btn btn-primary block-btn" onClick={() => setEditing('new')}>
        + Thói quen mới
      </button>
      {archived.length > 0 && (
        <>
          <h2 class="sub">Đang tắt</h2>
          <ul class="habits">
            {archived.map((h) => (
              <li class="habit">
                <div class="habit-main">
                  <span class="muted">{h.name}</span>
                  <button
                    type="button"
                    class="btn"
                    onClick={() => void upsertHabit({ ...h, archived: false })}
                  >
                    Bật
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {editing && (
        <HabitForm
          habit={editing === 'new' ? null : editing}
          startDate={today}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}
