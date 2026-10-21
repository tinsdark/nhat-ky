import type { Entry } from '../core/types'
import { createEntry, softDeleteEntry } from '../data/repository'

const SCALE = [1, 2, 3, 4, 5]

/**
 * Quick check-in (SPEC 5.3): one tap records how energetic or how good the mood is right now. It is
 * a real-time reading, so it lives on Hôm nay; the energy curve is built from these taps.
 */
export function CheckinBar({ onSaved }: { onSaved: (entry: Entry, label: string) => void }) {
  const record = async (kind: 'energy' | 'mood', value: number) => {
    const entry = await createEntry({
      type: 'note',
      start: new Date().toISOString(),
      title: kind === 'energy' ? 'Check-in năng lượng' : 'Check-in tâm trạng',
      payload: { checkin: { [kind]: value } },
      source: 'quick',
    })
    onSaved(entry, `${kind === 'energy' ? 'Năng lượng' : 'Tâm trạng'} ${value}/5`)
  }
  const row = (kind: 'energy' | 'mood', label: string) => (
    <div class="checkin-row">
      <span class="muted">{label}</span>
      <div class="choice">
        {SCALE.map((n) => (
          <button type="button" onClick={() => void record(kind, n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <div class="card checkin">
      {row('energy', 'Năng lượng bây giờ')}
      {row('mood', 'Tâm trạng bây giờ')}
    </div>
  )
}

export const undoCheckin = (id: string) => void softDeleteEntry(id)
