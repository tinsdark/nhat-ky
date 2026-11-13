import { useEffect, useRef, useState } from 'preact/hooks'
import { followToday, toDateKey } from '../core/date'

const TICK_MS = 60_000

/**
 * The current logical day and time, kept fresh while the app stays open: re-read every minute and
 * whenever the app comes back to the front (a home-screen app can sit suspended overnight).
 */
export function useNow(): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', tick)
    const t = setInterval(tick, TICK_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', tick)
      clearInterval(t)
    }
  }, [])
  return now
}

/**
 * The day a screen with day navigation shows. While it is on today it moves on to the new day when the
 * day cut passes; a day picked by hand stays.
 */
export function useViewedDay(todayKey: string): [string, (d: string) => void] {
  const [viewed, setViewed] = useState(todayKey)
  const prev = useRef(todayKey)
  useEffect(() => {
    if (prev.current === todayKey) return
    const from = prev.current
    prev.current = todayKey
    setViewed((v) => followToday(v, from, todayKey))
  }, [todayKey])
  return [viewed, setViewed]
}

export const todayOf = (now: number, dayStartHour: number) => toDateKey(now, dayStartHour)
