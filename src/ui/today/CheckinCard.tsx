import type { Entry } from '../../core/types'
import { Icon, type IconName } from '../Icon'

type Kind = 'energy' | 'mood'

const LABEL: Record<Kind, string> = { energy: 'Năng lượng bây giờ', mood: 'Tâm trạng bây giờ' }

/** Energy as five rising bars, the first `level` of them solid. */
function EnergyBars({ level }: { level: number }) {
  return (
    <svg
      class="ic"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <path d={`M${4 + i * 4} 20v-${3 + i * 3}`} opacity={i < level ? 1 : 0.25} />
      ))}
    </svg>
  )
}

/** The newest check-in value of one kind among today's entries. */
export function lastCheckin(entries: Entry[], kind: Kind): number | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!
    const v = (e.payload.checkin as Record<string, unknown> | undefined)?.[kind]
    if (e.type === 'note' && typeof v === 'number') return v
  }
  return null
}

/**
 * Quick check-in (SPEC 5.3): five equal buttons per row, one tap records. The last value taken today
 * stays highlighted so the row also shows how the day has felt.
 */
export function CheckinCard({
  entries,
  onRecord,
}: {
  entries: Entry[]
  onRecord: (kind: Kind, value: number) => void
}) {
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>Cảm giác bây giờ</h2>
      </div>
      {(['energy', 'mood'] as const).map((kind) => {
        const current = lastCheckin(entries, kind)
        return (
          <div class="scale-row">
            <span class="muted">{LABEL[kind]}</span>
            <div class="scale5" role="group" aria-label={LABEL[kind]}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  class={current === n ? 'on' : ''}
                  aria-label={`${LABEL[kind]}: ${n}/5`}
                  onClick={() => onRecord(kind, n)}
                >
                  <span class="face">
                    {kind === 'energy' ? (
                      <EnergyBars level={n} />
                    ) : (
                      <Icon name={`mood${n}` as IconName} size={28} />
                    )}
                  </span>
                  <span class="num">{n}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
