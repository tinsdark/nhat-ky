import { useEffect, useState } from 'preact/hooks'
import { PERIODS, type Period } from '../period'

const hhmm = () => new Date().toTimeString().slice(0, 5)

/** Current time as HH:mm, refreshed a few times a minute. */
function Clock() {
  const [t, setT] = useState(hhmm)
  useEffect(() => {
    const i = setInterval(() => setT(hhmm()), 15_000)
    return () => clearInterval(i)
  }, [])
  return <>{t}</>
}

/**
 * The big line at the top of a coloured band. On Hôm nay it is the time with the part of the day under it;
 * on a past day and on the other tabs it is a word (the weekday, the tab name). The strip marks where in the
 * day we are.
 */
export function BandTitle({
  word,
  label,
  sub,
  period,
}: {
  /** Shown big. Omit on Hôm nay to show the current time instead. */
  word?: string
  /** Bold part of the line under the big text ("Chiều"). */
  label?: string
  /** Muted part of that line ("đêm qua ngủ 6h52"). */
  sub?: string
  /** Today only: highlights this part of the day in the strip. */
  period?: Period
}) {
  return (
    <div class="bandtitle">
      <div class={word ? 'bt-word' : 'bt-word bt-time'}>{word ?? <Clock />}</div>
      {(label || sub) && (
        <div class="bt-sub">
          {label && <b>{label}</b>}
          {label && sub && ' · '}
          {sub}
        </div>
      )}
      {period && (
        <div class="bt-strip" aria-hidden="true">
          {PERIODS.map((p) => (
            <i class={p === period ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>
  )
}
