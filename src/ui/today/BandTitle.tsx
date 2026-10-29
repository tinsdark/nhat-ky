import { PERIODS, type Period } from '../period'

/**
 * The big word at the top of Hôm nay: the part of the day ("Chiều") on today, the weekday on a past day.
 * No clock: the word changes only a few times a day. The strip marks where in the day we are.
 */
export function BandTitle({
  word,
  sub,
  period,
}: {
  word: string
  sub?: string
  /** Today only: highlights this part of the day in the strip. */
  period?: Period
}) {
  return (
    <div class="bandtitle">
      <div class="bt-word">{word}</div>
      {sub && <div class="bt-sub">{sub}</div>}
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
