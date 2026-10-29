import type { CoreItem } from '../../core/timeline'
import { Icon } from '../Icon'

/**
 * One line of progress: x/y core items recorded, then the items themselves as plain text
 * (a ticked one has a check, a missing one an open dot). Not buttons, so no pill shape.
 */
export function Hero({ items }: { items: CoreItem[] }) {
  const done = items.filter((i) => i.done).length
  return (
    <section class="coreline" aria-label={`Đã ghi ${done}/${items.length} mục chính trong ngày`}>
      <strong>{done === items.length ? 'Đã ghi đủ' : `${done}/${items.length}`}</strong>
      {done < items.length &&
        items.map((i) => (
          <span class={i.done ? 'core done' : 'core'}>
            {i.done && <Icon name="check" size={14} />}
            {i.label}
          </span>
        ))}
    </section>
  )
}
