import { RULES, resolveThresholds } from '../../core/rules'
import type { Settings } from '../../core/types'
import { saveSettings } from '../../data/repository'
import { NumberInput, Section, Switch } from './fields'

const save = (patch: Partial<Settings>) => void saveSettings(patch)

/** One line per warning rule: switch on the right, thresholds underneath when the line is open. */
export function Alerts({ settings }: { settings: Settings }) {
  return (
    <Section
      title="Luật cảnh báo"
      hint="App nhắc khi thấy dấu hiệu như thiếu ngủ, ngủ thất thường, cà phê muộn. Tắt luật nào mày thấy phiền, chỉnh ngưỡng cho vừa."
    >
      <ul class="rows">
        {RULES.map((rule) => {
          const on = !settings.disabledRules.includes(rule.id)
          const p = resolveThresholds(rule, settings.ruleThresholds, settings)
          const editable = Object.keys(rule.defaults).filter(
            (k) => !rule.settingsBacked?.includes(k),
          )
          const overridden = editable.some((k) => `${rule.id}.${k}` in settings.ruleThresholds)
          return (
            <li class="ruleline">
              <details open={false}>
                <summary>
                  <span class="grow">
                    <span class="title">{rule.label}</span>
                    <span class="sub">
                      {on ? (editable.length ? 'Bấm để chỉnh ngưỡng' : 'Đang bật') : 'Đã tắt'}
                    </span>
                  </span>
                  <Switch
                    on={on}
                    label={`Bật luật ${rule.label}`}
                    onChange={(next) =>
                      save({
                        disabledRules: next
                          ? settings.disabledRules.filter((x) => x !== rule.id)
                          : [...settings.disabledRules, rule.id],
                      })
                    }
                  />
                </summary>
                {on && editable.length > 0 && (
                  <div class="thresholds">
                    {editable.map((k) => (
                      <div class="setrow">
                        <div class="grow">
                          <span class="sub">{rule.params[k]}</span>
                        </div>
                        <NumberInput
                          value={p[k]!}
                          onSave={(v) =>
                            save({
                              ruleThresholds: {
                                ...settings.ruleThresholds,
                                [`${rule.id}.${k}`]: v,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                    {overridden && (
                      <button
                        type="button"
                        class="btn small"
                        onClick={() => {
                          const next = { ...settings.ruleThresholds }
                          for (const k of editable) delete next[`${rule.id}.${k}`]
                          save({ ruleThresholds: next })
                        }}
                      >
                        Về mặc định
                      </button>
                    )}
                  </div>
                )}
              </details>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
