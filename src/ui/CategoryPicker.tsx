import { quickActionChoices } from '../core/defs'
import type { Category, QuickAction } from '../core/types'

/** After a shortcut for a type is pressed: pick what exactly happened, as tiles rather than a long list. */
export function CategoryPicker({
  title,
  action,
  categories,
  onPick,
  onOther,
  onClose,
}: {
  title: string
  action: Pick<QuickAction, 'type' | 'categoryIds'>
  categories: Category[]
  onPick: (c: Category) => void
  /** Used when the type has no category yet, or none fits. */
  onOther: () => void
  onClose: () => void
}) {
  const list = quickActionChoices(action, categories)
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{title}: làm gì?</h2>
        {list.length === 0 && (
          <p class="muted hint">
            Loại này chưa có danh mục. Thêm ở Sửa → Danh mục (chọn đúng loại), hoặc bấm Khác để ghi
            ngay.
          </p>
        )}
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
