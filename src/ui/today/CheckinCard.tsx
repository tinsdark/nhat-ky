import type { Entry } from '../../core/types'

const FACES = {
  energy: ['😴', '🥱', '😐', '🙂', '⚡'],
  mood: ['😞', '😕', '😐', '🙂', '😄'],
} as const

type Kind = keyof typeof FACES

const LABEL: Record<Kind, string> = { energy: 'Năng lượng bây giờ', mood: 'Tâm trạng bây giờ' }

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
              {FACES[kind].map((face, i) => (
                <button
                  type="button"
                  class={current === i + 1 ? 'on' : ''}
                  aria-label={`${LABEL[kind]}: ${i + 1}/5`}
                  onClick={() => onRecord(kind, i + 1)}
                >
                  <span class="face">{face}</span>
                  <span class="num">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
