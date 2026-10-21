import { useState } from 'preact/hooks'
import { addDays, toDateKey } from '../../core/date'
import { addMinutes, copyToDay } from '../../core/entryForm'
import { dueReminders } from '../../core/reminders'
import { reviewPrompt } from '../../core/review'
import { buildTimeline, coreProgress } from '../../core/timeline'
import type { Entry, Habit, QuickAction } from '../../core/types'
import { tickHabit } from '../../data/habits'
import {
  createEntry,
  getDay,
  getDefs,
  getEntriesByDateKey,
  getSettings,
  restoreEntry,
  softDeleteEntry,
} from '../../data/repository'
import { getOpenSleep, goToSleep, wakeUp } from '../../data/sleep'
import { DateNav } from '../DateNav'
import { DurationPicker } from '../DurationPicker'
import { EntryDetail } from '../EntryDetail'
import { draftFromEntry, EntryForm, type FormDraft } from '../EntryForm'
import { Icon } from '../Icon'
import { ManageDefs } from '../ManageDefs'
import { ReviewSheet } from '../ReviewSheet'
import { estimatedNote, SleepPrompt } from '../SleepPrompt'
import { CheckinCard } from '../today/CheckinCard'
import { Hero } from '../today/Hero'
import { QuickGrid } from '../today/QuickGrid'
import { SleepCard } from '../today/SleepCard'
import { Timeline } from '../today/Timeline'
import { Toast, type ToastData } from '../Toast'
import { useLive } from '../useLive'

/** Sleep has its own card, so these two buttons are not shown as tiles. */
const SLEEP_ACTIONS = new Set(['qa-sleep', 'qa-wake'])

export function Today() {
  const settings = useLive(getSettings, [])
  const defs = useLive(getDefs, [])
  const dayStartHour = settings?.dayStartHour ?? 4
  const todayKey = toDateKey(Date.now(), dayStartHour)
  const [dateKey, setDateKey] = useState(todayKey)
  const isToday = dateKey === todayKey
  const ownEntries = useLive(() => getEntriesByDateKey(dateKey), [dateKey])
  // The night that ended this morning started on the previous logical day; it still belongs on this day's timeline.
  const prevNight = useLive(async () => {
    const prev = await getEntriesByDateKey(addDays(dateKey, -1))
    return prev.filter(
      (e) => e.type === 'sleep' && e.end !== null && toDateKey(e.end, dayStartHour) === dateKey,
    )
  }, [dateKey, dayStartHour])
  const entries = ownEntries && prevNight ? [...prevNight, ...ownEntries] : undefined
  const day = useLive(() => getDay(dateKey), [dateKey])
  const openSleep = useLive(getOpenSleep, [])
  const todayDay = useLive(() => getDay(todayKey), [todayKey])
  const yesterdayKey = addDays(todayKey, -1)
  const yesterdayDay = useLive(() => getDay(yesterdayKey), [yesterdayKey])
  const yesterdayHasEntries = useLive(
    async () => (await getEntriesByDateKey(yesterdayKey)).length > 0,
    [yesterdayKey],
  )
  const [, setFlagTick] = useState(0) // localStorage flags are not reactive; bump to re-read them
  const [reviewFor, setReviewFor] = useState<string | null>(null)
  const [sleepPrompt, setSleepPrompt] = useState<{ id: string; note?: string } | null>(null)
  const [form, setForm] = useState<FormDraft | null>(null)
  const [detail, setDetail] = useState<Entry | null>(null)
  const [durationFor, setDurationFor] = useState<QuickAction | null>(null)
  const [managing, setManaging] = useState<{ startNew: boolean } | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)

  if (!settings || !defs || !entries) return null

  const categories = defs.categories
  const now = Date.now()
  const nowIso = () => new Date().toISOString()

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

  /** A work block estimated after the fact: ends now, started `minutes` ago. */
  const logWork = async (a: QuickAction, minutes: number) => {
    const end = nowIso()
    const entry = await createEntry({
      type: 'work',
      start: addMinutes(end, -minutes),
      end,
      categoryId: a.categoryId,
      title: a.title,
      source: 'quick',
    })
    setDurationFor(null)
    showSaved(entry, true)
  }

  const pressSleep = async () => {
    const entry = await goToSleep()
    setToast({
      id: Date.now(),
      text: entry ? 'Chúc ngủ ngon' : 'Đang có giấc ngủ chưa đóng, bấm Thức dậy',
      onUndo: entry ? () => void softDeleteEntry(entry.id) : undefined,
    })
  }

  const pressWake = async () => {
    const { entry, estimated } = await wakeUp()
    setSleepPrompt({ id: entry.id, note: estimated ? estimatedNote(entry.start) : undefined })
  }

  const quickTap = async (a: QuickAction) => {
    if (a.type === 'work') return setDurationFor(a)
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

  const recordCheckin = async (kind: 'energy' | 'mood', value: number) => {
    const entry = await createEntry({
      type: 'note',
      start: nowIso(),
      title: kind === 'energy' ? 'Check-in năng lượng' : 'Check-in tâm trạng',
      payload: { checkin: { [kind]: value } },
      source: 'quick',
    })
    setToast({
      id: Date.now(),
      text: `Đã ghi: ${kind === 'energy' ? 'năng lượng' : 'tâm trạng'} ${value}/5`,
      onUndo: () => void softDeleteEntry(entry.id),
    })
  }

  const tick = (h: Habit) =>
    void tickHabit(h, todayKey, dayStartHour, h.kind === 'duration' ? 10 : undefined)

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
  const reminders = isToday
    ? dueReminders({
        habits: defs.habits,
        todayEntries: ownEntries ?? [],
        todayKey,
        now,
        dayStartHour,
      })
    : []

  const progress = coreProgress(entries, day)
  const rows = buildTimeline(entries, isToday ? { now } : {})
  const actions = [...defs.quickActions]
    .sort((a, b) => a.order - b.order)
    .filter((a) => !SLEEP_ACTIONS.has(a.id))
  const lastNight = prevNight?.[prevNight.length - 1]

  return (
    <section class="screen today">
      <DateNav dateKey={dateKey} todayKey={todayKey} onChange={setDateKey} />

      {review && !reviewFor && (
        <div class="timerbar">
          <span>{review.kind === 'tonight' ? 'Chấm ngày hôm nay' : 'Hôm qua chưa chấm ngày'}</span>
          <div class="actions">
            {review.kind === 'yesterday' && (
              <button type="button" class="btn small" onClick={() => markAsked(review.dateKey)}>
                Bỏ qua
              </button>
            )}
            <button type="button" class="btn btn-primary small" onClick={() => openReview(review)}>
              Chấm
            </button>
          </div>
        </div>
      )}
      {reminders.map((h) => (
        <div class="timerbar" key={h.id}>
          <span>
            Nhắc {h.reminderTime}: {h.name}
          </span>
          <button type="button" class="btn btn-primary small" onClick={() => tick(h)}>
            Xong
          </button>
        </div>
      ))}
      {sleepPrompt && <SleepPrompt {...sleepPrompt} onClose={() => setSleepPrompt(null)} />}

      <Hero items={progress} isToday={isToday} />

      {isToday ? (
        <>
          <SleepCard
            open={openSleep}
            lastNight={lastNight}
            now={now}
            onSleep={() => void pressSleep()}
            onWake={() => void pressWake()}
          />
          <QuickGrid
            actions={actions}
            categories={categories}
            onTap={(a) => void quickTap(a)}
            onHold={(a) => setForm(draftFor(a))}
            onEdit={() => setManaging({ startNew: false })}
            onAdd={() => setManaging({ startNew: true })}
          />
          <CheckinCard entries={ownEntries ?? []} onRecord={(k, v) => void recordCheckin(k, v)} />
        </>
      ) : (
        <p class="muted hint pastnote">
          <Icon name="edit" size={14} /> Đây là ngày đã qua: nút bấm nhanh chỉ dùng cho hôm nay.
          Muốn ghi thêm thì sang tab <a href={`#/backfill?d=${dateKey}&s=12:00`}>Ghi bù</a>.
        </p>
      )}

      <Timeline
        rows={rows}
        categories={categories}
        tags={defs.tags}
        dateKey={dateKey}
        onOpen={setDetail}
      />

      {detail && (
        <EntryDetail
          entry={detail}
          categories={categories}
          tags={defs.tags}
          canCopyToToday={!isToday}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm(draftFromEntry(detail))
            setDetail(null)
          }}
          onDuplicate={() => {
            setForm({ ...draftFromEntry(detail), id: undefined })
            setDetail(null)
          }}
          onDelete={() => {
            const id = detail.id
            void softDeleteEntry(id)
            setDetail(null)
            setToast({ id: Date.now(), text: 'Đã xoá', onUndo: () => void restoreEntry(id) })
          }}
          onCopyToToday={async () => {
            const copy = await createEntry(copyToDay(detail, todayKey, dayStartHour))
            setDetail(null)
            setToast({
              id: Date.now(),
              text: 'Đã chép sang hôm nay',
              onEdit: () => setForm(draftFromEntry(copy)),
              onUndo: () => void softDeleteEntry(copy.id),
            })
          }}
        />
      )}
      {durationFor && (
        <DurationPicker
          title={durationFor.name}
          onPick={(m) => void logWork(durationFor, m)}
          onMore={() => {
            setForm({ ...draftFor(durationFor), start: nowIso() })
            setDurationFor(null)
          }}
          onClose={() => setDurationFor(null)}
        />
      )}
      {form && (
        <EntryForm
          draft={form}
          categories={categories}
          tags={defs.tags}
          dayStartHour={dayStartHour}
          onClose={() => setForm(null)}
          onSaved={showSaved}
        />
      )}
      {managing && (
        <ManageDefs
          initialTab="quick"
          startNew={managing.startNew}
          onClose={() => setManaging(null)}
        />
      )}
      {reviewFor && <ReviewSheet dateKey={reviewFor} onClose={() => setReviewFor(null)} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </section>
  )
}

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
