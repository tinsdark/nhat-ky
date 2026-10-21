import { useRef, useState } from 'preact/hooks'
import { addDays, atTime, toDateKey, toHHmm, weekday } from '../../core/date'
import { buildTimeline, coreProgress } from '../../core/timeline'
import type { Category, Entry, QuickAction } from '../../core/types'
import {
  createEntry,
  getDay,
  getDefs,
  getEntriesByDateKey,
  getSettings,
  softDeleteEntry,
} from '../../data/repository'
import { draftFromEntry, EntryForm, type FormDraft } from '../EntryForm'
import { SleepPrompt, type SleepPromptState } from '../SleepPrompt'
import { getRecentSleep, goToSleep, suggestBedtime, wakeUp } from '../../data/sleep'
import { shouldAskLastNight } from '../../core/sleep'
import { ReviewSheet } from '../ReviewSheet'
import { reviewPrompt } from '../../core/review'
import { TimerBar } from '../TimerBar'
import { getRunningTimer, startTimer } from '../../data/timer'
import { Toast, type ToastData } from '../Toast'
import { useLive } from '../useLive'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const LONG_PRESS_MS: number = 500

/** Short block height by duration: 44px minimum, 240px maximum. */
const blockHeight = (minutes: number) => Math.min(240, Math.max(44, Math.round(minutes * 0.5)))

export function Today() {
  const settings = useLive(getSettings, [])
  const defs = useLive(getDefs, [])
  const dayStartHour = settings?.dayStartHour ?? 4
  const todayKey = toDateKey(Date.now(), dayStartHour)
  const [dateKey, setDateKey] = useState(todayKey)
  const isToday = dateKey === todayKey
  const entries = useLive(() => getEntriesByDateKey(dateKey), [dateKey])
  const day = useLive(() => getDay(dateKey), [dateKey])
  const timer = useLive(getRunningTimer, [])
  const todayDay = useLive(() => getDay(todayKey), [todayKey])
  const yesterdayKey = addDays(todayKey, -1)
  const yesterdayDay = useLive(() => getDay(yesterdayKey), [yesterdayKey])
  const yesterdayHasEntries = useLive(
    async () => (await getEntriesByDateKey(yesterdayKey)).length > 0,
    [yesterdayKey],
  )
  const [, setFlagTick] = useState(0) // localStorage flags are not reactive; bump to re-read them
  const [reviewFor, setReviewFor] = useState<string | null>(null)
  const recentSleep = useLive(getRecentSleep, [])
  const [sleepPrompt, setSleepPrompt] = useState<SleepPromptState | null>(null)
  const [form, setForm] = useState<FormDraft | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)

  if (!settings || !defs || !entries) return null

  const categories = defs.categories
  const now = Date.now()
  // Any "now" tap on a past day lands at the same wall-clock time of that day.
  const nowIso = () =>
    isToday ? new Date().toISOString() : atTime(dateKey, toHHmm(Date.now()), dayStartHour)

  const draftFor = (a: QuickAction): FormDraft => ({
    dateKey,
    type: a.type,
    categoryId: a.categoryId,
    title: a.title,
    value: a.value,
    unit: a.unit,
    note: '',
    start: nowIso(),
    end: null,
    source: 'quick',
  })

  const showSaved = (entry: Entry, isNew: boolean) => {
    setForm(null)
    setToast({
      id: Date.now(),
      text: isNew ? `Đã ghi: ${entry.title || 'mục mới'}` : 'Đã lưu',
      onEdit: () => setForm(draftFromEntry(entry)),
      onUndo: isNew ? () => void softDeleteEntry(entry.id) : undefined,
    })
  }

  const beginTimer = async (fields: { categoryId?: string; title?: string }) => {
    const { entry, stopped } = await startTimer(fields)
    setForm(null)
    setToast({
      id: Date.now(),
      text: stopped ? 'Đã dừng timer cũ, bật timer mới' : 'Đã bật timer',
      onEdit: () => setForm(draftFromEntry(entry)),
      onUndo: () => void softDeleteEntry(entry.id),
    })
  }

  const askNight = async () => setSleepPrompt({ mode: 'night', suggestion: await suggestBedtime() })

  const sleepTap = async (a: QuickAction): Promise<boolean> => {
    if (!isToday) return false
    if (a.id === 'qa-sleep') {
      const entry = await goToSleep()
      setToast({
        id: Date.now(),
        text: entry ? 'Chúc ngủ ngon' : 'Đang có giấc ngủ chưa đóng — bấm Thức dậy',
        onUndo: entry ? () => void softDeleteEntry(entry.id) : undefined,
      })
      return true
    }
    if (a.id === 'qa-wake') {
      const entry = await wakeUp()
      if (entry) setSleepPrompt({ mode: 'quality', id: entry.id })
      else await askNight()
      return true
    }
    return false
  }

  const quickTap = async (a: QuickAction) => {
    if (await sleepTap(a)) return
    if (a.type === 'work') return beginTimer({ categoryId: a.categoryId, title: a.title })
    const entry = await createEntry({
      type: a.type,
      start: nowIso(),
      categoryId: a.categoryId,
      title: a.title,
      value: a.value,
      unit: a.unit,
      source: 'quick',
    })
    showSaved(entry, true)
  }

  const review = reviewPrompt({
    now,
    dayStartHour,
    reviewTime: settings.reviewTime,
    today: todayDay,
    yesterday: yesterdayDay,
    yesterdayHasEntries: yesterdayHasEntries ?? false,
    yesterdayAsked: flagged(reviewKey(yesterdayKey)),
  })
  const markAsked = (key: string) => {
    setFlag(reviewKey(key))
    setFlagTick((n) => n + 1)
  }
  const openReview = (r: { dateKey: string; kind: string }) => {
    if (r.kind === 'yesterday') markAsked(r.dateKey)
    setReviewFor(r.dateKey)
  }

  const progress = coreProgress(entries, day)
  const doneCount = progress.filter((p) => p.done).length
  const rows = buildTimeline(entries, isToday ? { now } : {})
  const [dd, mm] = dateKey.slice(5).split('-').reverse()

  return (
    <section class="screen today">
      <div class="datenav">
        <button
          type="button"
          aria-label="Hôm trước"
          onClick={() => setDateKey(addDays(dateKey, -1))}
        >
          ◀
        </button>
        <div>
          <strong>
            {WEEKDAYS[weekday(dateKey)]}, {dd}/{mm}
          </strong>
          {isToday && <span class="muted"> · Hôm nay</span>}
        </div>
        <button
          type="button"
          aria-label="Hôm sau"
          disabled={isToday}
          onClick={() => setDateKey(addDays(dateKey, 1))}
        >
          ▶
        </button>
      </div>

      {review && !reviewFor && (
        <div class="timerbar">
          <span>{review.kind === 'tonight' ? 'Chấm ngày hôm nay' : 'Hôm qua chưa chấm ngày'}</span>
          <div class="actions">
            {review.kind === 'yesterday' && (
              <button type="button" class="btn" onClick={() => markAsked(review.dateKey)}>
                Bỏ qua
              </button>
            )}
            <button type="button" class="btn btn-primary" onClick={() => openReview(review)}>
              Chấm
            </button>
          </div>
        </div>
      )}
      {sleepPrompt ? (
        <SleepPrompt
          state={sleepPrompt}
          onClose={() => {
            if (sleepPrompt.mode === 'night') dismissAsk(dateKey)
            setSleepPrompt(null)
          }}
          onRecorded={(id) => setSleepPrompt({ mode: 'quality', id })}
        />
      ) : (
        isToday &&
        recentSleep &&
        !askDismissed(dateKey) &&
        shouldAskLastNight(recentSleep, now, dayStartHour) && (
          <div class="timerbar">
            <span>Tối qua chưa ghi giấc ngủ.</span>
            <button type="button" class="btn btn-primary" onClick={() => void askNight()}>
              Nhập
            </button>
          </div>
        )
      )}
      <TimerBar timer={timer} categories={categories} />

      <div class="progress" aria-label={`Đã ghi ${doneCount}/${progress.length} mục cốt lõi`}>
        <div class="bar">
          <div style={{ width: `${(doneCount / progress.length) * 100}%` }} />
        </div>
        <span class="muted">
          Đã ghi {doneCount}/{progress.length}
        </span>
        <div class="chips">
          {progress.map((p) => (
            <span class={p.done ? 'chip done' : 'chip'}>{p.label}</span>
          ))}
        </div>
      </div>

      <div class="quickgrid">
        {[...defs.quickActions]
          .sort((a, b) => a.order - b.order)
          .map((a) => (
            <QuickButton
              action={a}
              onTap={() => void quickTap(a)}
              onHold={() => setForm(draftFor(a))}
            />
          ))}
      </div>

      <div class="timeline">
        {rows.length === 0 && <p class="muted">Chưa ghi gì cho ngày này.</p>}
        {rows.map((r) =>
          r.kind === 'gap' ? (
            <button
              type="button"
              class="gap"
              onClick={() =>
                setForm({
                  dateKey,
                  type: 'activity',
                  categoryId: '',
                  title: '',
                  value: null,
                  unit: '',
                  note: '',
                  start: r.start,
                  end: r.end,
                })
              }
            >
              chưa ghi · {toHHmm(r.start)}–{toHHmm(r.end)}
            </button>
          ) : (
            <button
              type="button"
              class="block"
              style={{
                minHeight: `${blockHeight(r.minutes)}px`,
                borderLeftColor: colorOf(categories, r.entry),
              }}
              onClick={() => setForm(draftFromEntry(r.entry))}
            >
              <span class="time">
                {toHHmm(r.entry.start)}
                {r.entry.end ? `–${toHHmm(r.entry.end)}` : ''}
              </span>
              <span>{r.entry.title || labelOf(categories, r.entry)}</span>
              {r.entry.value != null && (
                <span class="muted">
                  {r.entry.value} {r.entry.unit}
                </span>
              )}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        class="fab"
        aria-label="Ghi mới"
        onClick={() =>
          setForm({
            dateKey,
            type: 'activity',
            categoryId: '',
            title: '',
            value: null,
            unit: '',
            note: '',
            start: nowIso(),
            end: null,
          })
        }
      >
        +
      </button>

      {form && (
        <EntryForm
          draft={form}
          categories={categories}
          dayStartHour={dayStartHour}
          onClose={() => setForm(null)}
          onSaved={showSaved}
          onStartTimer={isToday ? (f) => void beginTimer(f) : undefined}
        />
      )}
      {reviewFor && <ReviewSheet dateKey={reviewFor} onClose={() => setReviewFor(null)} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </section>
  )
}

const askKey = (dateKey: string) => `nk_sleepAsk_${dateKey}`
const reviewKey = (dateKey: string) => `nk_reviewAsked_${dateKey}`
function flagged(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function setFlag(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // storage unavailable: the prompt may show again on reload
  }
}
const askDismissed = (dateKey: string) => flagged(askKey(dateKey))
const dismissAsk = (dateKey: string) => setFlag(askKey(dateKey))

function colorOf(categories: Category[], e: Entry): string {
  return categories.find((c) => c.id === e.categoryId)?.color ?? 'var(--border)'
}

function labelOf(categories: Category[], e: Entry): string {
  return categories.find((c) => c.id === e.categoryId)?.name ?? e.type
}

/** Tap = one entry; press and hold = open the form pre-filled. */
function QuickButton({
  action,
  onTap,
  onHold,
}: {
  action: QuickAction
  onTap: () => void
  onHold: () => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const held = useRef(false)
  const clear = () => clearTimeout(timer.current)
  return (
    <button
      type="button"
      class="quick"
      onPointerDown={() => {
        held.current = false
        timer.current = setTimeout(() => {
          held.current = true
          onHold()
        }, LONG_PRESS_MS)
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!held.current) onTap()
      }}
    >
      <span class="ico">{action.icon}</span>
      {action.name}
    </button>
  )
}
