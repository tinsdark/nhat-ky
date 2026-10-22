import type { ComponentChildren } from 'preact'
import type { EntryType } from '../core/types'
import { Choice, scale } from './Choice'

export type Payload = Record<string, unknown>

function Text({
  label,
  value,
  onChange,
  inputMode,
  list,
}: {
  label: string
  value: unknown
  onChange: (v: string) => void
  inputMode?: 'decimal' | 'numeric'
  list?: string
}) {
  return (
    <label>
      {label}
      <input
        inputMode={inputMode}
        list={list}
        value={value == null ? '' : String(value)}
        onInput={(e) => onChange(e.currentTarget.value)}
      />
    </label>
  )
}

function Group({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <fieldset class="group">
      <legend>{title}</legend>
      {children}
    </fieldset>
  )
}

const yesNo = [
  { id: 'yes', label: 'Có' },
  { id: 'no', label: 'Không' },
]
const toBool = (v: unknown) => (v === true ? 'yes' : v === false ? 'no' : undefined)

/** Per-type fields (SPEC modules 3.2, 4.2, 5.1–5.3). Edits `payload` through `set`, undefined removes a key. */
export function PayloadFields({
  type,
  payload,
  set,
  projects = [],
}: {
  type: EntryType
  payload: Payload
  set: (key: string, value: unknown) => void
  /** Project names to suggest (history, most used first). */
  projects?: string[]
}) {
  if (type === 'sleep') {
    return (
      <Group title="Giấc ngủ">
        <Choice
          label="Chất lượng"
          options={scale(5)}
          value={payload.quality}
          onChange={(v) => set('quality', v)}
        />
        <Text
          label="Số lần tỉnh giữa đêm"
          inputMode="numeric"
          value={payload.wakeUps}
          onChange={(v) => set('wakeUps', v === '' ? undefined : Number(v))}
        />
        <Choice
          label="Dùng màn hình trước ngủ"
          options={yesNo}
          value={toBool(payload.screenBeforeBed)}
          onChange={(v) => set('screenBeforeBed', v === undefined ? undefined : v === 'yes')}
        />
        <Choice
          label="Dậy bằng"
          options={[
            { id: 'alarm', label: 'Báo thức' },
            { id: 'natural', label: 'Tự dậy' },
          ]}
          value={payload.alarm === true ? 'alarm' : payload.alarm === false ? 'natural' : undefined}
          onChange={(v) => set('alarm', v === undefined ? undefined : v === 'alarm')}
        />
        <Choice
          label="Loại"
          options={[
            { id: 'night', label: 'Ngủ đêm' },
            { id: 'nap', label: 'Ngủ trưa' },
          ]}
          value={payload.nap === true ? 'nap' : 'night'}
          onChange={(v) => set('nap', v === 'nap' ? true : undefined)}
        />
      </Group>
    )
  }

  if (type === 'meal') {
    return (
      <Group title="Bữa ăn">
        <Choice
          label="Bữa"
          options={[
            { id: 'breakfast', label: 'Sáng' },
            { id: 'lunch', label: 'Trưa' },
            { id: 'dinner', label: 'Tối' },
            { id: 'snack', label: 'Phụ' },
            { id: 'late', label: 'Khuya' },
          ]}
          value={payload.mealSlot}
          onChange={(v) => set('mealSlot', v)}
        />
        <Text
          label="Món (cách nhau dấu phẩy)"
          value={Array.isArray(payload.items) ? payload.items.join(', ') : ''}
          onChange={(v) =>
            set(
              'items',
              v.trim() === ''
                ? undefined
                : v
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
            )
          }
        />
        <Choice
          label="Ăn ở"
          options={[
            { id: 'home', label: 'Nhà' },
            { id: 'office', label: 'Công ty' },
            { id: 'out', label: 'Ngoài' },
            { id: 'delivery', label: 'Giao' },
          ]}
          value={payload.place}
          onChange={(v) => set('place', v)}
        />
        <Choice
          label="Khẩu phần"
          options={[
            { id: 'little', label: 'Ít' },
            { id: 'normal', label: 'Vừa' },
            { id: 'full', label: 'No căng' },
          ]}
          value={payload.portion}
          onChange={(v) => set('portion', v)}
        />
        <Choice
          label="Chất lượng"
          options={[
            { id: 1, label: 'Nhiều rau' },
            { id: 2, label: 'Bình thường' },
            { id: 3, label: 'Dầu mỡ/ngọt' },
          ]}
          value={payload.quality}
          onChange={(v) => set('quality', v)}
        />
        <Choice
          label="Đồ uống"
          options={[
            { id: 'coffee', label: 'Cà phê' },
            { id: 'tea', label: 'Trà' },
            { id: 'milktea', label: 'Trà sữa' },
            { id: 'alcohol', label: 'Bia/rượu' },
            { id: 'soft', label: 'Nước ngọt' },
          ]}
          value={payload.drink}
          onChange={(v) => set('drink', v)}
        />
        <Choice
          label="Sau ăn thấy"
          options={[
            { id: 'alert', label: 'Tỉnh táo' },
            { id: 'normal', label: 'Bình thường' },
            { id: 'sleepy', label: 'Buồn ngủ' },
            { id: 'uncomfortable', label: 'Khó chịu' },
          ]}
          value={payload.afterFeel}
          onChange={(v) => set('afterFeel', v)}
        />
      </Group>
    )
  }

  if (type === 'work' || type === 'activity' || type === 'study') {
    return (
      <Group title={type === 'work' ? 'Công việc' : type === 'study' ? 'Học tập' : 'Hoạt động'}>
        <datalist id="project-suggestions">
          {projects.map((p) => (
            <option value={p} />
          ))}
        </datalist>
        <Text
          label={type === 'study' ? 'Môn / khoá học' : 'Dự án / hệ thống'}
          list="project-suggestions"
          value={payload.project}
          onChange={(v) => set('project', v || undefined)}
        />
        <Choice
          label="Tập trung"
          options={scale(5)}
          value={payload.focus}
          onChange={(v) => set('focus', v)}
        />
        <Text
          label="Số lần bị cắt ngang"
          inputMode="numeric"
          value={payload.interruptions}
          onChange={(v) => set('interruptions', v === '' ? undefined : Number(v))}
        />
        <Choice
          label="Địa điểm"
          options={[
            { id: 'office', label: 'Văn phòng' },
            { id: 'home', label: 'Nhà' },
            { id: 'cafe', label: 'Quán' },
          ]}
          value={payload.location}
          onChange={(v) => set('location', v)}
        />
        {payload.isOvertime === true && <p class="muted">Ngoài giờ làm việc (tăng ca).</p>}
      </Group>
    )
  }

  if (type === 'exercise') {
    return (
      <Group title="Vận động">
        <Text
          label="Môn (chạy, gym, đạp xe…)"
          value={payload.kind}
          onChange={(v) => set('kind', v || undefined)}
        />
        <Choice
          label="Cường độ"
          options={[
            { id: 'light', label: 'Nhẹ' },
            { id: 'moderate', label: 'Vừa' },
            { id: 'hard', label: 'Nặng' },
          ]}
          value={payload.intensity}
          onChange={(v) => set('intensity', v)}
        />
        <Text
          label="Quãng đường (km)"
          inputMode="decimal"
          value={payload.distance}
          onChange={(v) => set('distance', v === '' ? undefined : Number(v.replace(',', '.')))}
        />
      </Group>
    )
  }

  if (type === 'note') {
    const checkin = (payload.checkin ?? {}) as { mood?: number; energy?: number; tags?: string[] }
    const patch = (key: 'mood' | 'energy', v: number | undefined) =>
      set('checkin', { ...checkin, [key]: v })
    const tags = checkin.tags ?? []
    const toggle = (t: string) =>
      set('checkin', {
        ...checkin,
        tags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t],
      })
    return (
      <Group title="Check-in">
        <Choice
          label="Tâm trạng"
          options={scale(5)}
          value={checkin.mood}
          onChange={(v) => patch('mood', v)}
        />
        <Choice
          label="Năng lượng"
          options={scale(5)}
          value={checkin.energy}
          onChange={(v) => patch('energy', v)}
        />
        <div class="field">
          <span class="lbl">Cảm xúc</span>
          <div class="choice">
            {['vui', 'mệt', 'lo', 'cáu', 'chán', 'hào hứng'].map((t) => (
              <button type="button" class={tags.includes(t) ? 'on' : ''} onClick={() => toggle(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </Group>
    )
  }

  return null
}
