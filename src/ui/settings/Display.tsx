import type { Settings } from '../../core/types'
import { changeDayStartHour, saveSettings } from '../../data/repository'
import { Choice } from '../Choice'
import { Section, SetRow, Switch } from './fields'

const save = (patch: Partial<Settings>) => void saveSettings(patch)

/** Look, the day's cut-off, reminders. */
export function Display({ settings }: { settings: Settings }) {
  return (
    <>
      <Section title="Giao diện">
        <SetRow title="Màu sắc" stacked>
          <Choice
            label=""
            options={[
              { id: 'system', label: 'Theo máy' },
              { id: 'light', label: 'Sáng' },
              { id: 'dark', label: 'Tối' },
            ]}
            value={settings.theme}
            onChange={(v) => v && save({ theme: v })}
          />
        </SetRow>
      </Section>

      <Section title="Ngày và nhắc nhở">
        <SetRow
          title="Ngày kết thúc lúc"
          hint="Giờ sáng hôm sau. Ngủ lúc 00:40 vẫn tính vào đêm hôm trước."
        >
          <select
            value={String(settings.dayStartHour)}
            onChange={async (e) => {
              const hour = Number(e.currentTarget.value)
              if (hour === settings.dayStartHour) return
              if (
                !confirm(
                  `Đổi giờ cắt ngày sang ${String(hour).padStart(2, '0')}:00? Các mục ghi trong khoảng giữa hai mốc sẽ chuyển sang ngày khác.`,
                )
              ) {
                e.currentTarget.value = String(settings.dayStartHour)
                return
              }
              await changeDayStartHour(hour)
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <option value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </SetRow>
        <SetRow title="Nhắc chấm ngày từ" hint="Sau giờ này màn Hôm nay hiện nhắc chấm điểm ngày.">
          <input
            type="time"
            value={settings.reviewTime}
            onChange={(e) => save({ reviewTime: e.currentTarget.value })}
          />
        </SetRow>
        <SetRow title="Ngày ốm / đi xa" hint="Không tính trượt thói quen và không làm đứt chuỗi.">
          <Switch
            on={settings.skipRestDays}
            label="Bỏ qua ngày ốm hoặc đi xa"
            onChange={(on) => save({ skipRestDays: on })}
          />
        </SetRow>
      </Section>
    </>
  )
}
