import { useState } from 'preact/hooks'
import { ENTRY_TYPES } from '../../core/defs'
import { getDefs } from '../../data/repository'
import { Icon } from '../Icon'
import { ManageDefs } from '../ManageDefs'
import { useLive } from '../useLive'
import { Section } from './fields'

type Tab = 'quick' | 'cat' | 'tag' | 'type'

/** Entry point to the editors: one tappable line per list, with its count. */
export function Categories() {
  const defs = useLive(getDefs, [])
  const [open, setOpen] = useState<Tab | null>(null)
  if (!defs) return null
  const lines: { tab: Tab; title: string; sub: string; count: number }[] = [
    {
      tab: 'quick',
      title: 'Nút ghi nhanh',
      sub: 'Các ô ở màn Hôm nay: thêm, sửa, đổi thứ tự',
      count: defs.quickActions.length,
    },
    {
      tab: 'cat',
      title: 'Danh mục',
      sub: 'Ăn sáng, Deep work, Học BA… Đổi màu, nhóm thời gian, ẩn bớt',
      count: defs.categories.filter((c) => !c.archived).length,
    },
    {
      tab: 'type',
      title: 'Loại',
      sub: 'Loại có sẵn và loại tự đặt (thuốc, cân nặng…)',
      count: ENTRY_TYPES.length + (defs.customTypes ?? []).filter((t) => !t.archived).length,
    },
    {
      tab: 'tag',
      title: 'Tag',
      sub: 'Nhãn gắn vào từng mục ("ăn ngoài", "tăng ca")',
      count: defs.tags.length,
    },
  ]
  return (
    <>
      <Section title="Danh mục và nút nhanh" hint="Mọi thứ mày ghi đều dựa trên các danh sách này.">
        <ul class="rows">
          {lines.map((l) => (
            <li>
              <button type="button" class="rowbtn" onClick={() => setOpen(l.tab)}>
                <span class="grow">
                  <span class="title">{l.title}</span>
                  <span class="sub">{l.sub}</span>
                </span>
                <span class="end">{l.count}</span>
                <Icon name="chevR" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </Section>
      {open && <ManageDefs initialTab={open} onClose={() => setOpen(null)} />}
    </>
  )
}
