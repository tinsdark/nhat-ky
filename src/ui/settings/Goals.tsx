import type { Settings } from '../../core/types'
import { saveSettings } from '../../data/repository'
import { formatWaterSizes, parseWaterSizes } from '../../core/water'
import { NumberInput, Section, SetRow } from './fields'

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const save = (patch: Partial<Settings>) => void saveSettings(patch)

/** Working hours, daily and weekly targets, weekly time budgets. */
export function Goals({ settings }: { settings: Settings }) {
  const budgets = settings.weeklyBudgets
  return (
    <>
      <Section
        title="Giờ làm việc"
        hint="Dùng để tính giờ tăng ca: khối làm việc ngoài khung này là tăng ca."
      >
        <SetRow title="Bắt đầu">
          <input
            type="time"
            value={settings.workStart}
            onChange={(e) => save({ workStart: e.currentTarget.value })}
          />
        </SetRow>
        <SetRow title="Kết thúc">
          <input
            type="time"
            value={settings.workEnd}
            onChange={(e) => save({ workEnd: e.currentTarget.value })}
          />
        </SetRow>
        <SetRow title="Ngày làm việc" stacked>
          <div class="choice">
            {DAY_LABELS.map((label, i) => {
              const on = settings.workDays.includes(i)
              return (
                <button
                  type="button"
                  class={on ? 'on' : ''}
                  onClick={() =>
                    save({
                      workDays: on
                        ? settings.workDays.filter((d) => d !== i)
                        : [...settings.workDays, i].sort(),
                    })
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </SetRow>
      </Section>

      <Section title="Mục tiêu sức khoẻ">
        <SetRow title="Ngủ mỗi đêm">
          <NumberInput
            value={settings.sleepTargetHours}
            unit="giờ"
            onSave={(v) => save({ sleepTargetHours: v })}
          />
        </SetRow>
        <SetRow title="Nước mỗi ngày">
          <NumberInput
            value={settings.waterTargetMl}
            unit="ml"
            onSave={(v) => save({ waterTargetMl: v })}
          />
        </SetRow>
        <SetRow
          title="Các mức lượng khi uống nước"
          hint="Cách nhau dấu phẩy: 2–8 mức, mỗi mức 10–3000 ml."
          stacked
        >
          <input
            key={formatWaterSizes(settings.waterSizes)}
            aria-label="Các mức lượng nước (ml)"
            defaultValue={formatWaterSizes(settings.waterSizes)}
            onBlur={(e) => {
              const sizes = parseWaterSizes(e.currentTarget.value)
              if (sizes) save({ waterSizes: sizes })
              else e.currentTarget.value = formatWaterSizes(settings.waterSizes)
            }}
          />
        </SetRow>
        <SetRow title="Vận động mỗi tuần">
          <NumberInput
            value={settings.exerciseTargetMinPerWeek}
            unit="phút"
            onSave={(v) => save({ exerciseTargetMinPerWeek: v })}
          />
        </SetRow>
      </Section>

      <Section
        title="Mục tiêu giờ mỗi tuần"
        hint="Màn Thống kê → Thời gian hiện tiến độ, và lời khuyên báo khi lệch."
      >
        <SetRow title="Deep work (tối thiểu)">
          <NumberInput
            value={budgets.deepWorkHours}
            unit="giờ"
            onSave={(v) => save({ weeklyBudgets: { ...budgets, deepWorkHours: v } })}
          />
        </SetRow>
        <SetRow title="Học BA (tối thiểu)">
          <NumberInput
            value={budgets.baHours}
            unit="giờ"
            onSave={(v) => save({ weeklyBudgets: { ...budgets, baHours: v } })}
          />
        </SetRow>
        <SetRow title="Mạng xã hội (tối đa)">
          <NumberInput
            value={budgets.socialHours}
            unit="giờ"
            onSave={(v) => save({ weeklyBudgets: { ...budgets, socialHours: v } })}
          />
        </SetRow>
      </Section>
    </>
  )
}
