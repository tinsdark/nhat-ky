import { lazy, Suspense } from 'preact/compat'
import { signOut } from '../../auth'
import { RULES, resolveThresholds } from '../../core/rules'
import type { Settings as SettingsData } from '../../core/types'
import { getSettings, saveSettings } from '../../data/repository'
import { engine } from '../../sync'
import { BackupSection } from '../BackupSection'
import { Choice } from '../Choice'
import { useLive } from '../useLive'

const DevPanel = import.meta.env.DEV ? lazy(() => import('../DevPanel')) : null

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function NumberField({
  label,
  value,
  onSave,
  hint,
}: {
  label: string
  value: number
  onSave: (v: number) => void
  hint?: string
}) {
  return (
    <label>
      {label}
      <input
        key={value}
        inputMode="decimal"
        defaultValue={String(value).replace('.', ',')}
        onChange={(e) => {
          const v = Number(e.currentTarget.value.replace(',', '.'))
          if (e.currentTarget.value.trim() !== '' && Number.isFinite(v)) onSave(v)
        }}
      />
      {hint && <span class="hint">{hint}</span>}
    </label>
  )
}

export function Settings({ onSignedOut }: { onSignedOut: () => void }) {
  const settings = useLive(getSettings, [])
  const logout = async () => {
    await signOut()
    engine.markAuthRequired()
    onSignedOut()
  }
  if (!settings) return null
  const save = (patch: Partial<SettingsData>) => void saveSettings(patch)
  const yesNo = (v: boolean) => (v ? 'yes' : 'no')

  return (
    <section class="screen settings">
      <h1>Cài đặt</h1>

      <h2 class="sub">Giờ làm việc</h2>
      <div class="form">
        <div class="row">
          <label>
            Bắt đầu
            <input
              type="time"
              value={settings.workStart}
              onChange={(e) => save({ workStart: e.currentTarget.value })}
            />
          </label>
          <label>
            Kết thúc
            <input
              type="time"
              value={settings.workEnd}
              onChange={(e) => save({ workEnd: e.currentTarget.value })}
            />
          </label>
        </div>
        <div class="field">
          <span class="lbl">Ngày làm việc</span>
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
        </div>
      </div>

      <h2 class="sub">Mục tiêu</h2>
      <div class="form">
        <NumberField
          label="Ngủ (giờ/đêm)"
          value={settings.sleepTargetHours}
          onSave={(v) => save({ sleepTargetHours: v })}
        />
        <NumberField
          label="Nước (ml/ngày)"
          value={settings.waterTargetMl}
          onSave={(v) => save({ waterTargetMl: v })}
        />
        <NumberField
          label="Vận động (phút/tuần)"
          value={settings.exerciseTargetMinPerWeek}
          onSave={(v) => save({ exerciseTargetMinPerWeek: v })}
        />
      </div>

      <h2 class="sub">Nhắc nhở và tuỳ chọn</h2>
      <div class="form">
        <label>
          Nhắc chấm ngày từ
          <input
            type="time"
            value={settings.reviewTime}
            onChange={(e) => save({ reviewTime: e.currentTarget.value })}
          />
        </label>
        <Choice
          label="Ngày ốm / đi xa không tính trượt thói quen"
          options={[
            { id: 'yes', label: 'Bật' },
            { id: 'no', label: 'Tắt' },
          ]}
          value={yesNo(settings.skipRestDays)}
          onChange={(v) => v && save({ skipRestDays: v === 'yes' })}
        />
        <Choice
          label="Tải ảnh lên Drive"
          options={[
            { id: 'no', label: 'Mọi mạng' },
            { id: 'yes', label: 'Chỉ Wi-Fi' },
          ]}
          value={yesNo(settings.photosWifiOnly)}
          onChange={(v) => v && save({ photosWifiOnly: v === 'yes' })}
        />
        <p class="muted hint">
          Ngày bắt đầu là {String(settings.dayStartHour).padStart(2, '0')}:00 sáng hôm sau, không
          đổi được vì mọi bản ghi đã gắn ngày theo mốc này.
        </p>
      </div>

      <h2 class="sub">Ngưỡng cảnh báo</h2>
      <div class="form">
        {RULES.map((rule) => {
          const p = resolveThresholds(
            rule,
            settings.ruleThresholds,
            settings.exerciseTargetMinPerWeek,
          )
          const overridden = Object.keys(rule.defaults).some(
            (k) => `${rule.id}.${k}` in settings.ruleThresholds,
          )
          return (
            <fieldset class="group">
              <legend>{rule.label}</legend>
              {Object.keys(rule.defaults).map((k) => (
                <NumberField
                  label={rule.params[k]!}
                  value={p[k]!}
                  onSave={(v) =>
                    save({ ruleThresholds: { ...settings.ruleThresholds, [`${rule.id}.${k}`]: v } })
                  }
                />
              ))}
              {overridden && (
                <button
                  type="button"
                  class="btn"
                  onClick={() => {
                    const next = { ...settings.ruleThresholds }
                    for (const k of Object.keys(rule.defaults)) delete next[`${rule.id}.${k}`]
                    save({ ruleThresholds: next })
                  }}
                >
                  Về mặc định
                </button>
              )}
            </fieldset>
          )
        })}
      </div>

      <BackupSection dayStartHour={settings.dayStartHour} />

      {DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}

      <h2 class="sub">Tài khoản</h2>
      <div class="stack">
        <button type="button" class="btn" onClick={() => void engine.run()}>
          Đồng bộ ngay
        </button>
        <button type="button" class="btn btn-danger" onClick={() => void logout()}>
          Đăng xuất
        </button>
      </div>
    </section>
  )
}
