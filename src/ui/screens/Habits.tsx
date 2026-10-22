import { useMemo, useState } from 'preact/hooks'
import { createMetricContext } from '../../core/metrics'
import { addDays, toDateKey } from '../../core/date'
import {
  completionRate,
  describeSchedule,
  describeTarget,
  bestStreak,
  habitProgress,
  habitStatusText,
  heatmap,
  isDoneToday,
  isScheduled,
  streakUnit,
  streaks,
  type HabitOptions,
} from '../../core/habits'
import type { Habit } from '../../core/types'
import { tickHabit, untickHabit, upsertHabit } from '../../data/habits'
import { getDaysInRange, getDefs, getEntriesInRange, getSettings } from '../../data/repository'
import { HabitForm } from '../HabitForm'
import { Icon } from '../Icon'
import { useLive } from '../useLive'

const HISTORY_DAYS = 120
const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)

export function Habits() {
  const settings = useLive(getSettings, [])
  const defs = useLive(getDefs, [])
  const dayStartHour = settings?.dayStartHour ?? 4
  const today = toDateKey(Date.now(), dayStartHour)
  // Streaks and rates need every day since a habit started, not only the last HISTORY_DAYS.
  const earliestStart = defs?.habits.reduce((m, h) => (h.startDate < m ? h.startDate : m), today)
  const minFrom = addDays(today, -HISTORY_DAYS)
  const from = earliestStart && earliestStart < minFrom ? earliestStart : minFrom
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
    loggedDays: new Set(entries.map((e) => e.dateKey)),
  }
  const active = defs.habits.filter((h) => !h.archived)
  const archived = defs.habits.filter((h) => h.archived)
  const dueToday = active.filter((h) => isScheduled(h, today))
  const offToday = active.filter((h) => !isScheduled(h, today))

  const rowData = (h: Habit) => {
    const values = ctx.habitValues(h)
    const value = values.get(today) ?? 0
    const met = isDoneToday(h, value)
    return {
      h,
      values,
      value,
      met,
      progress: habitProgress(h, value),
      st: streaks(h, values, today, opts),
      auto: h.linkedRule !== null || !!h.metricRule,
    }
  }
  const dueRows = dueToday.map(rowData)
  const doneCount = dueRows.filter((r) => r.met).length
  const best = bestStreak(dueRows)

  const card = (r: ReturnType<typeof rowData>, dim = false) => {
    const { h, values, value, met, progress, st, auto } = r
    const unit = streakUnit(h)
    const isOpen = open === h.id
    return (
      <li class={dim ? 'hcard dim' : 'hcard'}>
        <div class="hmain">
          <button
            type="button"
            class="hbody"
            onClick={() => setOpen(isOpen ? null : h.id)}
            aria-expanded={isOpen}
          >
            <Progress progress={progress} met={met} />
            <span class="grow">
              <span class="title">{h.name}</span>
              <span class="sub">
                {habitStatusText(h, value, met)}
                {' · '}
                {describeSchedule(h.schedule)}
                {auto ? ' · tự tính' : ''}
              </span>
              {st.current > 0 && (
                <span class="streak">
                  <Icon name="flame" size={13} /> {st.current} {unit}
                </span>
              )}
            </span>
          </button>
          {!auto &&
            !dim &&
            (h.kind === 'check' ? (
              <button
                type="button"
                class={met ? 'tick on' : 'tick'}
                aria-label={met ? 'Bỏ đánh dấu' : 'Đánh dấu'}
                onClick={() =>
                  void (met ? untickHabit(h, today) : tickHabit(h, today, dayStartHour))
                }
              >
                <Icon name="check" size={22} />
              </button>
            ) : (
              <button
                type="button"
                class="tick"
                aria-label={h.kind === 'duration' ? 'Thêm 10 phút' : 'Thêm 1 lần'}
                onClick={() =>
                  void tickHabit(h, today, dayStartHour, h.kind === 'duration' ? 10 : 1)
                }
              >
                {h.kind === 'duration' ? '+10p' : '+1'}
              </button>
            ))}
        </div>
        {isOpen && (
          <div class="hdetail">
            <div class="stats3">
              {[7, 30, 90].map((d) => (
                <div>
                  <strong>{pct(completionRate(h, values, today, d, opts))}</strong>
                  <span class="muted">{d} ngày</span>
                </div>
              ))}
            </div>
            <p class="muted hint">
              Chuỗi hiện tại {st.current} {unit}, dài nhất {st.longest} {unit}.
              {describeTarget(h) ? ` Đạt khi ${describeTarget(h)}.` : ''}
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
            <p class="muted hint">Ô đậm = đạt, nhạt = làm một phần, gạch chéo = không có lịch.</p>
            <div class="row">
              {!auto && h.kind !== 'check' && value > 0 && (
                <button type="button" class="btn small" onClick={() => void untickHabit(h, today)}>
                  Hoàn tác lần cuối
                </button>
              )}
              <button type="button" class="btn small" onClick={() => setEditing(h)}>
                Sửa
              </button>
              <button
                type="button"
                class="btn small"
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
      <p class="muted lead">Việc nhỏ lặp lại. Đánh dấu ngay ở đây hoặc ở tab Hôm nay.</p>

      <section class="panel hero">
        <div class="hero-top">
          <HeroRing done={doneCount} total={dueRows.length} />
          <div>
            <strong class="hero-title">
              {dueRows.length === 0
                ? 'Hôm nay không có thói quen theo lịch'
                : doneCount === dueRows.length
                  ? 'Hôm nay đạt hết rồi'
                  : `Đã đạt ${doneCount}/${dueRows.length} thói quen`}
            </strong>
            <span class="muted">
              {best && best.st.current > 0
                ? `Chuỗi dài nhất đang chạy: ${best.h.name}, ${best.st.current} ${best.h.schedule.kind === 'timesPerWeek' ? 'tuần' : 'ngày'}`
                : 'Giữ đều vài ngày là có chuỗi đầu tiên.'}
            </span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Hôm nay</h2>
          <button type="button" class="btn small" onClick={() => setEditing('new')}>
            <Icon name="plus" size={14} /> Thêm
          </button>
        </div>
        {dueRows.length === 0 ? (
          <p class="muted empty">
            Chưa có thói quen nào theo lịch hôm nay. Bật một thói quen mẫu bên dưới hoặc thêm mới.
          </p>
        ) : (
          <ul class="hlist">{dueRows.map((r) => card(r))}</ul>
        )}
      </section>

      {offToday.length > 0 && (
        <section class="panel">
          <div class="panel-head">
            <h2>Không có lịch hôm nay</h2>
          </div>
          <ul class="hlist">{offToday.map((h) => card(rowData(h), true))}</ul>
        </section>
      )}

      {archived.length > 0 && (
        <section class="panel">
          <div class="panel-head">
            <h2>Thói quen mẫu và đang tắt</h2>
          </div>
          <ul class="rows">
            {archived.map((h) => (
              <li>
                <div class="grow">
                  <span class="title">{h.name}</span>
                  <span class="sub">
                    {describeSchedule(h.schedule)}
                    {h.metricRule
                      ? ' · tự tính từ giờ ngủ/dậy'
                      : h.linkedRule
                        ? ' · tự tính từ mục khác'
                        : ''}
                  </span>
                </div>
                <button
                  type="button"
                  class="btn small"
                  onClick={() => void upsertHabit({ ...h, archived: false })}
                >
                  Bật
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details class="panel howto">
        <summary>Thói quen hoạt động thế nào?</summary>
        <ul>
          <li>
            <b>Tick tay</b>: có/không (đã làm chưa), số lần (+1) hoặc số phút (+10p mỗi lần chạm).
            Mỗi lần tick là một mục ghi trong ngày.
          </li>
          <li>
            <b>Tự tính</b>: nước uống và vận động lấy từ mục đã ghi; "Dậy trước 7h", "Ngủ trước
            23h30" lấy từ giờ ngủ. Không cần tick.
          </li>
          <li>
            <b>Đạt</b> khi giá trị trong ngày thoả mục tiêu. Thói quen "bỏ" đạt khi số lần bằng 0.
          </li>
          <li>
            <b>Chuỗi</b> là số ngày có lịch liên tiếp đều đạt; ngày không có lịch không làm đứt
            chuỗi. Lịch "x lần/tuần" tính theo tuần.
          </li>
          <li>
            <b>Nhắc</b>: đặt giờ nhắc thì trong app hiện nhắc ở Hôm nay đến khi xong (chưa có thông
            báo đẩy).
          </li>
        </ul>
      </details>

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

const R = 20
const C = 2 * Math.PI * R

/** Round progress with a check inside once met; the ring fills as the day's value approaches the target. */
function Progress({ progress, met }: { progress: number; met: boolean }) {
  return (
    <span class={met ? 'hring met' : 'hring'}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={R} fill="none" stroke="var(--surface)" stroke-width="5" />
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke="var(--accent)"
          stroke-width="5"
          stroke-linecap="round"
          stroke-dasharray={`${progress * C} ${C}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      {met && <Icon name="check" size={18} />}
    </span>
  )
}

function HeroRing({ done, total }: { done: number; total: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 64 64" class="ring" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface)" stroke-width="7" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="var(--accent)"
        stroke-width="7"
        stroke-linecap="round"
        stroke-dasharray={`${total ? (done / total) * c : 0} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="37" text-anchor="middle" font-size="16" font-weight="700" fill="var(--fg)">
        {done}/{total}
      </text>
    </svg>
  )
}
