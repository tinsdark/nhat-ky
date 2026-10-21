import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, atTime, toDateKey } from '../core/date'
import type { Insight } from '../core/types'
import { db } from './db'
import { decideExperiment, settleExperiments, startExperiment } from './experiments'
import { getInsightStore, saveInsightStore } from './insights'
import { getDefs, saveDay } from './repository'
import { tickHabit } from './habits'

const today = () => toDateKey(Date.now(), 4)

const insight: Insight = {
  id: 'corr:bedtime>energy:0',
  source: 'correlation',
  kind: 'corr:bedtime>energy:0',
  text: '',
  confidence: 'strong',
  status: 'new',
  hiddenUntil: null,
  action: 'Thử đi ngủ trước 23h30 trong 5 ngày tới.',
  score: 3,
  lastSeenDate: today(),
  lastShownDate: null,
  createdAt: '',
  updatedAt: '',
}

beforeEach(async () => {
  await Promise.all([
    db.entries.clear(),
    db.days.clear(),
    db.defs.clear(),
    db.insights.clear(),
    db.settings.clear(),
    db.meta.clear(),
  ])
  await saveInsightStore({ items: [insight], weights: {}, lastRunDate: null, experiments: [] })
})

describe('experiment flow', () => {
  it('Thử creates a temporary habit and a running experiment, and marks the insight as trying', async () => {
    expect(await startExperiment(insight)).toBe(true)
    const store = await getInsightStore()
    expect(store.experiments).toHaveLength(1)
    expect(store.experiments[0]!.status).toBe('running')
    expect(store.items[0]!.status).toBe('trying')
    const habits = (await getDefs()).habits
    expect(habits.find((h) => h.id === store.experiments[0]!.habitId)?.name).toBe(
      'Thử: đi ngủ trước 23h30',
    )
  })

  it('refuses insights that cannot be tested', async () => {
    expect(await startExperiment({ ...insight, kind: 'rule:low_water', action: null })).toBe(false)
  })

  it('settles after the window, then Giữ renames the habit and Bỏ archives it', async () => {
    await startExperiment(insight)
    let store = await getInsightStore()
    const exp = store.experiments[0]!
    // Move the experiment into the past so it is due, and give it data: baseline 14 days, 8 kept days.
    const start = addDays(today(), -20)
    await saveInsightStore({
      ...store,
      experiments: [{ ...exp, startDate: start, endDate: addDays(start, 13) }],
    })
    const habit = (await getDefs()).habits.find((h) => h.id === exp.habitId)!
    for (let i = -14; i < 14; i++) {
      const d = addDays(start, i)
      await saveDay(d, { energy: i < 0 ? ((i % 2 ? 2 : 3) as 2 | 3) : ((i % 2 ? 4 : 5) as 4 | 5) })
    }
    for (let i = 0; i < 8; i++)
      await tickHabit({ ...habit, startDate: start }, addDays(start, i), 4)
    // the tick helper stamps "now" for today only; fix the stamps of past days to their own day
    for (const e of await db.entries.toArray())
      await db.entries.update(e.id, { start: atTime(e.dateKey, '22:00') })
    await db.defs.update('defs', {
      habits: (await getDefs()).habits.map((h) =>
        h.id === habit.id ? { ...h, startDate: start } : h,
      ),
    })

    await settleExperiments()
    store = await getInsightStore()
    expect(store.experiments[0]!.status).toBe('finished')
    expect(store.experiments[0]!.result?.verdict).toBe('better')

    await decideExperiment(exp.id, true)
    expect((await getDefs()).habits.find((h) => h.id === exp.habitId)).toMatchObject({
      name: 'đi ngủ trước 23h30',
      archived: false,
    })
    expect((await getInsightStore()).experiments[0]!.status).toBe('kept')
  })

  it('Bỏ archives the habit', async () => {
    await startExperiment(insight)
    const exp = (await getInsightStore()).experiments[0]!
    await decideExperiment(exp.id, false)
    expect((await getDefs()).habits.find((h) => h.id === exp.habitId)?.archived).toBe(true)
    expect((await getInsightStore()).items[0]!.status).toBe('hidden')
  })
})
