import type { Category, EntryType } from '../core/types'

/** After a shortcut for a type is pressed: pick what exactly happened, as tiles rather than a long list. */
export function CategoryPicker({
  title,
  type,
  categories,
  onPick,
  onOther,
  onClose,
}: {
  title: string
  type: EntryType
  categories: Category[]
  onPick: (c: Category) => void
  /** Used when the type has no category yet, or none fits. */
  onOther: () => void
  onClose: () => void
}) {
  const list = categories
    .filter((c) => c.entryType === type && !c.archived)
    .sort((a, b) => a.order - b.order)
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{title}: làm gì?</h2>
        <div class="quickgrid">
          {list.map((c) => (
            <button type="button" class="quick" onClick={() => onPick(c)}>
              <span
                class="ico"
                style={{ background: `color-mix(in srgb, ${c.color} 22%, var(--card))` }}
              >
                {c.icon}
              </span>
              {c.name}
            </button>
          ))}
          <button type="button" class="quick" onClick={onOther}>
            <span class="ico">…</span>
            Khác
          </button>
        </div>
      </div>
    </div>
  )
}
