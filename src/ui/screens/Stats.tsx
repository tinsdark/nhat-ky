import { useMemo, useState } from 'preact/hooks'
import { addDays, toDateKey } from '../../core/date'
import { allMetrics, createMetricContext } from '../../core/metrics'
import { getDaysInRange, getDefs, getEntriesInRange, getSettings } from '../../data/repository'
import { Choice } from '../Choice'
import { Food } from '../stats/Food'
import { Health } from '../stats/Health'
import { Overview } from '../stats/Overview'
import { Time } from '../stats/Time'
import { HISTORY_DAYS, type StatsData } from '../stats/shared'
import { useLive } from '../useLive'

type Tab = 'overview' | 'food' | 'time' | 'health'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'food', label: 'Ăn uống' },
  { id: 'time', label: 'Thời gian' },
  { id: 'health', label: 'Sức khoẻ' },
]

export function Stats() {
  const settings = useLive(getSettings, [])
  const defs = useLive(getDefs, [])
  const today = toDateKey(Date.now(), settings?.dayStartHour ?? 4)
  const from = addDays(today, -HISTORY_DAYS)
  const entries = useLive(() => getEntriesInRange(from, today), [from, today])
  const days = useLive(() => getDaysInRange(from, today), [from, today])
  const [tab, setTab] = useState<Tab>('overview')

  const data = useMemo<StatsData | null>(() => {
    if (!settings || !defs || !entries || !days) return null
    const ctx = createMetricContext({ entries, days, habits: defs.habits, settings })
    return { ctx, metrics: allMetrics(defs.habits), today, settings, defs, entries, days }
  }, [settings, defs, entries, days, today])

  if (!data) return null
  return (
    <section class="screen">
      <h1>Thống kê</h1>
      <Choice label="" options={TABS} value={tab} onChange={(v) => v && setTab(v)} />
      {tab === 'overview' && <Overview data={data} />}
      {tab === 'food' && <Food data={data} />}
      {tab === 'time' && <Time data={data} />}
      {tab === 'health' && <Health data={data} />}
    </section>
  )
}
