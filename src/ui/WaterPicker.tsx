import { useState } from 'preact/hooks'

/** "Uống bao nhiêu?": the usual amounts as tiles (the last one drunk is lit), or any other amount. */
export function WaterPicker({
  sizes,
  last,
  onPick,
  onClose,
}: {
  sizes: number[]
  last: number | null
  onPick: (ml: number) => void
  onClose: () => void
}) {
  const [other, setOther] = useState('')
  const otherMl = Number(other.replace(',', '.'))
  const otherOk = other.trim() !== '' && Number.isFinite(otherMl) && otherMl > 0 && otherMl <= 3000
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <form
        class="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (otherOk) onPick(Math.round(otherMl))
        }}
      >
        <h2>Uống bao nhiêu?</h2>
        <div class="choice big">
          {sizes.map((ml) => (
            <button type="button" class={ml === last ? 'on' : ''} onClick={() => onPick(ml)}>
              {ml} ml
            </button>
          ))}
        </div>
        <div class="row">
          <label>
            Lượng khác (ml)
            <input
              inputMode="numeric"
              value={other}
              onInput={(e) => setOther(e.currentTarget.value)}
            />
          </label>
          <button type="submit" class="btn btn-primary" disabled={!otherOk}>
            Ghi
          </button>
        </div>
      </form>
    </div>
  )
}
