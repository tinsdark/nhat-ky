import { useState } from 'preact/hooks'
import { lazy, Suspense } from 'preact/compat'
import { signOut } from '../../auth'
import { RULES, resolveThresholds } from '../../core/rules'
import type { Settings as SettingsData } from '../../core/types'
import { changeDayStartHour, getSettings, saveSettings } from '../../data/repository'
import { engine } from '../../sync'
import { appLock } from '../../lock'
import { BackupSection } from '../BackupSection'
import { Choice } from '../Choice'
import { ManageDefs } from '../ManageDefs'
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
  const [managing, setManaging] = useState(false)
  const [lockOn, setLockOn] = useState(() => appLock.isEnabled())
  const [lockMsg, setLockMsg] = useState('')
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

      <h2 class="sub">Danh mục, nút nhanh, tag</h2>
      <div class="form">
        <button type="button" class="btn" onClick={() => setManaging(true)}>
          Sửa danh mục, nút nhanh và tag
        </button>
      </div>
      {managing && <ManageDefs onClose={() => setManaging(false)} />}

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
          label="Deep work (giờ/tuần, tối thiểu)"
          value={settings.weeklyBudgets.deepWorkHours}
          onSave={(v) => save({ weeklyBudgets: { ...settings.weeklyBudgets, deepWorkHours: v } })}
        />
        <NumberField
          label="Học BA (giờ/tuần, tối thiểu)"
          value={settings.weeklyBudgets.baHours}
          onSave={(v) => save({ weeklyBudgets: { ...settings.weeklyBudgets, baHours: v } })}
        />
        <NumberField
          label="Mạng xã hội (giờ/tuần, tối đa)"
          value={settings.weeklyBudgets.socialHours}
          onSave={(v) => save({ weeklyBudgets: { ...settings.weeklyBudgets, socialHours: v } })}
        />
        <NumberField
          label="Vận động (phút/tuần)"
          value={settings.exerciseTargetMinPerWeek}
          onSave={(v) => save({ exerciseTargetMinPerWeek: v })}
        />
      </div>

      <h2 class="sub">Nhắc nhở và tuỳ chọn</h2>
      <div class="form">
        <Choice
          label="Giao diện"
          options={[
            { id: 'system', label: 'Theo máy' },
            { id: 'light', label: 'Sáng' },
            { id: 'dark', label: 'Tối' },
          ]}
          value={settings.theme}
          onChange={(v) => v && save({ theme: v })}
        />
        <label>
          Ngày kết thúc lúc (giờ sáng hôm sau)
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
        </label>
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
        <Choice
          label="Giữ ảnh lớn trên Drive và máy"
          options={[
            { id: 'forever', label: 'Mãi mãi' },
            { id: '12', label: '12 tháng (sau đó chỉ giữ ảnh thu nhỏ)' },
          ]}
          value={settings.photoFullMonths === 12 ? '12' : 'forever'}
          onChange={(v) => v && save({ photoFullMonths: v === '12' ? 12 : 0 })}
        />
        <p class="muted hint">
          Mặc định ngày kết thúc lúc 04:00 sáng hôm sau, nên ngủ lúc 00:40 vẫn tính vào đêm hôm
          trước.
        </p>
      </div>

      <h2 class="sub">Khoá app</h2>
      <div class="form">
        <Choice
          label="Khoá bằng Face ID / vân tay / mã máy (chỉ trên máy này)"
          options={[
            { id: 'off', label: 'Tắt' },
            { id: 'on', label: 'Bật' },
          ]}
          value={lockOn ? 'on' : 'off'}
          onChange={async (v) => {
            if (v === 'on' && !lockOn) {
              const ok = await appLock.enable()
              setLockOn(ok)
              setLockMsg(
                ok
                  ? 'Đã bật khoá. App tự khoá lại sau 2 phút không dùng.'
                  : 'Không bật được: máy không hỗ trợ hoặc đã huỷ.',
              )
            }
            if (v === 'off' && lockOn) {
              if (await appLock.unlock()) {
                appLock.disable()
                setLockOn(false)
                setLockMsg('Đã tắt khoá.')
              }
            }
          }}
        />
        <p class="muted hint">
          Khoá chỉ chặn người cầm máy mở app, không mã hoá dữ liệu. Không có máy chủ nên không có
          "quên mã": nếu mất quyền truy cập, xoá dữ liệu trang của app trong trình duyệt rồi đăng
          nhập lại để sync từ Drive về.
        </p>
        {lockMsg && <p class="muted">{lockMsg}</p>}
      </div>

      <h2 class="sub">Luật cảnh báo</h2>
      <div class="form">
        {RULES.map((rule) => {
          const p = resolveThresholds(rule, settings.ruleThresholds, settings)
          const editable = Object.keys(rule.defaults).filter(
            (k) => !rule.settingsBacked?.includes(k),
          )
          const on = !settings.disabledRules.includes(rule.id)
          const overridden = editable.some((k) => `${rule.id}.${k}` in settings.ruleThresholds)
          return (
            <fieldset class="group">
              <legend>{rule.label}</legend>
              <Choice
                label=""
                options={[
                  { id: 'on', label: 'Bật' },
                  { id: 'off', label: 'Tắt' },
                ]}
                value={on ? 'on' : 'off'}
                onChange={(v) =>
                  v &&
                  save({
                    disabledRules:
                      v === 'off'
                        ? [...settings.disabledRules, rule.id]
                        : settings.disabledRules.filter((x) => x !== rule.id),
                  })
                }
              />
              {on &&
                editable.map((k) => (
                  <NumberField
                    label={rule.params[k]!}
                    value={p[k]!}
                    onSave={(v) =>
                      save({
                        ruleThresholds: { ...settings.ruleThresholds, [`${rule.id}.${k}`]: v },
                      })
                    }
                  />
                ))}
              {on && overridden && (
                <button
                  type="button"
                  class="btn"
                  onClick={() => {
                    const next = { ...settings.ruleThresholds }
                    for (const k of editable) delete next[`${rule.id}.${k}`]
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
